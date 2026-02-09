import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get("t");

  if (trackingId) {
    // Fire-and-forget: don't block the pixel response
    (async () => {
      try {
        // Increment open count on every load
        await prisma.emailLog.updateMany({
          where: { trackingId },
          data: { opensCount: { increment: 1 } },
        });
        // Set openedAt only on first open
        await prisma.emailLog.updateMany({
          where: { trackingId, openedAt: null },
          data: { openedAt: new Date() },
        });
      } catch {
        // Silently ignore tracking failures
      }
    })();
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(TRANSPARENT_GIF.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
