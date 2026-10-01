import { NextRequest, NextResponse } from "next/server";
import { getOptionalStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { readDownloadToken } from "@/lib/download-token";

/**
 * Two ways in. `?id=` for a logged-in student (the portal). `?token=` for a buy-now purchase,
 * from the thank-you page or the delivery email — no login, see `lib/download-token.ts`. The
 * token only names who and what; the access row is required on both paths, so revoking access
 * kills an emailed link too.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  let studentId: string;
  let id: string | null;
  if (token) {
    const claim = readDownloadToken(token);
    if (!claim) {
      return NextResponse.json(
        { error: "This download link has expired. Log in to your account to download your purchase." },
        { status: 403 },
      );
    }
    studentId = claim.studentId;
    id = claim.productId;
  } else {
    const student = await getOptionalStudent();
    if (!student) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    studentId = student.id;
    id = request.nextUrl.searchParams.get("id");
  }

  if (!id) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  // Verify student owns this product
  const access = await prisma.digitalProductAccess.findUnique({
    where: {
      studentId_digitalProductId: {
        studentId,
        digitalProductId: id,
      },
    },
    include: { digitalProduct: true },
  });

  if (!access) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Generate signed URL (60 minutes)
  const { data, error } = await supabaseAdmin.storage
    .from("products")
    .createSignedUrl(access.digitalProduct.fileUrl, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to generate download link" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
