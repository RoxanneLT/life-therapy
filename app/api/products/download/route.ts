import { NextRequest, NextResponse } from "next/server";
import { getOptionalStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const student = await getOptionalStudent();
  if (!student) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing product id" }, { status: 400 });
  }

  // Verify student owns this product
  const access = await prisma.digitalProductAccess.findUnique({
    where: {
      studentId_digitalProductId: {
        studentId: student.id,
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
