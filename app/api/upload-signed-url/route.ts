import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";

/**
 * Generate a signed upload URL for direct browser→Supabase uploads.
 * This bypasses Vercel's 4.5 MB body size limit for serverless functions.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { bucket, fileName, contentType } = body as {
    bucket: string;
    fileName: string;
    contentType: string;
  };

  if (!bucket || !fileName || !contentType) {
    return NextResponse.json(
      { error: "Missing bucket, fileName, or contentType" },
      { status: 400 },
    );
  }

  const allowedBuckets = ["images", "products"];
  if (!allowedBuckets.includes(bucket)) {
    return NextResponse.json(
      { error: "Invalid bucket" },
      { status: 400 },
    );
  }

  const ext = fileName.split(".").pop();
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `uploads/${safeName}`;

  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    signedUrl: data.signedUrl,
    path,
    token: data.token,
  });
}
