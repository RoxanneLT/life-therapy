import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { REGION_CONFIG } from "@/lib/region";

/**
 * Our own hosts, derived from the region config rather than listed again here.
 *
 * The hand-written list had `life-therapy.co.za` and not `life-therapy.online`,
 * so tracked links to the international domain were the ones this endpoint
 * treated as foreign — the dual-domain trap, wearing a security list's clothes.
 */
const OUR_HOSTS = Object.values(REGION_CONFIG).map((r) => r.domain);

function isOurHost(hostname: string): boolean {
  const hosts =
    process.env.NODE_ENV === "production" ? OUR_HOSTS : [...OUR_HOSTS, "localhost"];
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

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

  // The destination is read from the LIVE request every time — nothing stores
  // where a tracked link was supposed to go, so there is nothing to check it
  // against. Anyone can call this endpoint directly with a URL of their choosing.
  //
  // The old rule was `!isAllowedHost && protocol !== "https:"`, which rejected
  // only a URL that was BOTH foreign AND not https — so every https:// address
  // on earth passed. That made this a redirector on the practice's own domain:
  // a link beginning life-therapy.co.za that lands wherever the sender likes,
  // which is precisely what a phishing link wants to be.
  //
  // Our hosts only. If genuinely external links are ever needed in emails, the
  // safe way is to store the destination against the tracking id and resolve it
  // here — not to trust the query string.
  if (!["http:", "https:"].includes(parsed.protocol) || !isOurHost(parsed.hostname)) {
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
