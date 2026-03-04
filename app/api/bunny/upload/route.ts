/**
 * POST /api/bunny/upload
 *
 * Admin-only endpoint to upload worksheets / PDFs to Bunny Storage Zone.
 *
 * Accepts multipart/form-data with fields:
 *   file        - The file to upload
 *   courseSlug  - e.g. "foundations-of-self-confidence"
 *   moduleSlug  - e.g. "module-1-building-blocks"
 *
 * Returns: { url: string }  — the public CDN URL
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { uploadToStorage, worksheetStoragePath } from "@/lib/bunny";

// Allow uploads up to 20 MB
export const maxDuration = 60;

const ALLOWED_TYPES = [
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function POST(req: NextRequest) {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const courseSlug = (formData.get("courseSlug") as string) || "general";
  const moduleSlug = (formData.get("moduleSlug") as string) || "misc";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type not allowed: ${file.type}` },
      { status: 400 }
    );
  }

  // 20 MB limit
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 20 MB)" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = worksheetStoragePath(courseSlug, moduleSlug, file.name);

  const url = await uploadToStorage(buffer, path, file.type);

  return NextResponse.json({ url });
}
