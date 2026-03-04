/**
 * POST /api/bunny/stream
 *
 * Admin-only endpoint to upload course videos to Bunny Stream.
 *
 * Step 1 — Create video entry (returns GUID + upload instructions)
 *   Body: { action: "create", title: string }
 *   Returns: { guid: string, embedUrl: string }
 *
 * Step 2 — Upload video bytes (proxies file to Bunny)
 *   Accepts multipart/form-data with fields:
 *     file - The video file (mp4, mov, etc.)
 *     guid - The GUID from Step 1
 *   Returns: { success: true, embedUrl: string }
 *
 * For videos > 500 MB, use direct TUS upload from the client side
 * (Bunny supports tus.io resumable uploads natively).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createStreamVideo,
  uploadStreamVideo,
  getStreamEmbedUrl,
  extractStreamGuid,
  deleteStreamVideo,
} from "@/lib/bunny";

export const maxDuration = 120; // 2 minutes for video proxying

const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
  "video/mpeg",
];

export async function POST(req: NextRequest) {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";

  // ── JSON: create video entry ─────────────────────────────────────────────
  if (contentType.includes("application/json")) {
    const { action, title } = await req.json();

    if (action !== "create" || !title) {
      return NextResponse.json(
        { error: "Provide { action: 'create', title: string }" },
        { status: 400 }
      );
    }

    const { guid } = await createStreamVideo(title as string);
    return NextResponse.json({ guid, embedUrl: getStreamEmbedUrl(guid) });
  }

  // ── Multipart: upload video bytes ────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const guid = formData.get("guid") as string | null;

    if (!file || !guid) {
      return NextResponse.json(
        { error: "Provide file and guid" },
        { status: 400 }
      );
    }

    if (!VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // 500 MB proxy limit — larger files should use direct TUS upload
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Video too large to proxy (max 500 MB). Use direct TUS upload." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadStreamVideo(guid, buffer);

    return NextResponse.json({ success: true, embedUrl: getStreamEmbedUrl(guid) });
  }

  return NextResponse.json(
    { error: "Unsupported content-type" },
    { status: 400 }
  );
}

/**
 * DELETE /api/bunny/stream
 *
 * Delete a video from Bunny Stream by its embed URL.
 * Body: { embedUrl: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { embedUrl } = await req.json();
  if (!embedUrl) {
    return NextResponse.json({ error: "Provide { embedUrl }" }, { status: 400 });
  }

  const guid = extractStreamGuid(embedUrl);
  if (!guid) {
    return NextResponse.json({ error: "Could not extract GUID from URL" }, { status: 400 });
  }

  await deleteStreamVideo(guid);
  return NextResponse.json({ success: true });
}
