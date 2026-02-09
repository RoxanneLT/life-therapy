import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const ALLOWED_HOSTS = [
  "life-therapy.co.za",
  "www.life-therapy.co.za",
  "localhost",
];

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get("t");
  const encodedUrl = request.nextUrl.searchParams.get("url");

  if (!encodedUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const targetUrl = decodeURIComponent(encodedUrl);

  // Validate URL safety — must be HTTP(S) and from a known host
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json({ error: "Invalid protocol" }, { status: 400 });
  }

  // Allow life-therapy.co.za and any external HTTPS URLs (legitimate email links)
  const isAllowedHost = ALLOWED_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  if (!isAllowedHost && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Untrusted URL" }, { status: 400 });
  }

  if (trackingId) {
    // Fire-and-forget: don't block the redirect
    (async () => {
      try {
        await prisma.emailLog.updateMany({
          where: { trackingId },
          data: { clicksCount: { increment: 1 } },
        });
        await prisma.emailLog.updateMany({
          where: { trackingId, clickedAt: null },
          data: { clickedAt: new Date() },
        });
      } catch {
        // Silently ignore tracking failures
      }
    })();
  }

  return NextResponse.redirect(targetUrl, 302);
}
