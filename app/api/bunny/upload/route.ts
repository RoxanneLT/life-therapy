/**
 * POST /api/bunny/upload
 *
 * Returns a direct upload URL + API key so the browser can PUT the file
 * straight to Bunny Storage, bypassing Vercel's 4.5 MB payload limit.
 *
 * Body: { fileName: string, courseSlug?: string, moduleSlug?: string }
 * Returns: { uploadUrl, apiKey, cdnUrl }
 *
 * The client then does:
 *   PUT uploadUrl  (headers: { AccessKey: apiKey, Content-Type: mimeType })
 *   body: raw file bytes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { worksheetStoragePath, getCdnUrl } from "@/lib/bunny";

const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME!;
const STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY!;
const STORAGE_REGION = process.env.BUNNY_STORAGE_REGION || "de";

const STORAGE_HOSTNAMES: Record<string, string> = {
  de: "storage.bunnycdn.com",
  ny: "ny.storage.bunnycdn.com",
  la: "la.storage.bunnycdn.com",
  sg: "sg.storage.bunnycdn.com",
  syd: "syd.storage.bunnycdn.com",
};

const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".zip", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".webp",
]);

export async function POST(req: NextRequest) {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { fileName, courseSlug = "general", moduleSlug = "misc" } = await req.json();

  if (!fileName || typeof fileName !== "string") {
    return NextResponse.json({ error: "Provide { fileName: string }" }, { status: 400 });
  }

  const ext = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `File type not allowed: ${ext}` }, { status: 400 });
  }

  const path = worksheetStoragePath(courseSlug, moduleSlug, fileName);
  const hostname = STORAGE_HOSTNAMES[STORAGE_REGION] || STORAGE_HOSTNAMES.de;

  return NextResponse.json({
    uploadUrl: `https://${hostname}/${STORAGE_ZONE_NAME}/${path}`,
    apiKey: STORAGE_API_KEY,
    cdnUrl: getCdnUrl(path),
  });
}
