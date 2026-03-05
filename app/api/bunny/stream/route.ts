/**
 * POST /api/bunny/stream
 *
 * Creates a Bunny Stream video entry and returns the direct upload URL +
 * API key so the browser can PUT the file straight to Bunny, bypassing
 * Vercel's 4.5 MB serverless payload limit entirely.
 *
 * Body: { title: string }
 * Returns: { guid, uploadUrl, apiKey, embedUrl }
 *
 * The client then does:
 *   PUT uploadUrl  (headers: { AccessKey: apiKey, Content-Type: video/* })
 *   body: raw file bytes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createStreamVideo,
  getStreamEmbedUrl,
  extractStreamGuid,
  deleteStreamVideo,
} from "@/lib/bunny";

const STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID!;
const STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { title } = await req.json();
  if (!title) {
    return NextResponse.json({ error: "Provide { title: string }" }, { status: 400 });
  }

  const { guid } = await createStreamVideo(title as string);

  return NextResponse.json({
    guid,
    uploadUrl: `https://video.bunnycdn.com/library/${STREAM_LIBRARY_ID}/videos/${guid}`,
    apiKey: STREAM_API_KEY,
    embedUrl: getStreamEmbedUrl(guid),
  });
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
