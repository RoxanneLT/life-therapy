import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyTrackedTarget } from "@/lib/email-tracking";

/**
 * The decision about what may be forwarded lives in lib/email-tracking.ts, beside
 * the wrapper that decides what to WRAP. They are two halves of one rule, and
 * this endpoint's history is what happens when they live apart: hardening this
 * side alone turned every Teams link in every email into a client-facing error
 * page (§6, 2026-08-19).
 *
 * `isOurHost` behind it derives from REGION_CONFIG rather than a hand-written
 * list. The list it replaced had `life-therapy.co.za` and not
 * `life-therapy.online`, so tracked links to the international domain were the
 * ones this endpoint treated as foreign — the dual-domain trap, wearing a
 * security list's clothes.
 */

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.searchParams.get("t");
  const encodedUrl = request.nextUrl.searchParams.get("url");

  if (!encodedUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  const targetUrl = decodeURIComponent(encodedUrl);

  // The destination is read from the LIVE request every time — nothing stores
  // where a tracked link was supposed to go, so there is nothing to check it
  // against by tracking id. Anyone can call this endpoint directly with a URL of
  // their choosing.
  //
  // The old rule was `!isAllowedHost && protocol !== "https:"`, which rejected
  // only a URL that was BOTH foreign AND not https — so every https:// address
  // on earth passed. That made this a redirector on the practice's own domain:
  // a link beginning life-therapy.co.za that lands wherever the sender likes,
  // which is precisely what a phishing link wants to be.
  //
  // Our own hosts, plus the narrow legacy repair: a foreign URL is forwarded only
  // if it exactly matches a Teams link we already hold on a booking. The rule and
  // its reasoning live in lib/email-tracking.ts, beside the wrapper that has to
  // agree with it — keeping them apart is what caused the incident.
  const verdict = await classifyTrackedTarget(targetUrl, async (url) => {
    const known = await prisma.booking.count({ where: { teamsMeetingUrl: url } });
    return known > 0;
  });

  if (!verdict.forward) {
    // Say so out loud. This used to return before touching anything, so a refused
    // click incremented no counter — `clicksCount` could not tell "never clicked"
    // from "clicked and got an error page", and the only reason anyone learned the
    // Teams links were broken is that a client sent a screenshot. An absence of
    // evidence was reading as evidence of absence.
    //
    // A log line, not a database write: the `metadata` column already holds things,
    // and a JSON column cannot be appended to without reading it first — so writing
    // the refusal there would silently discard whatever the send recorded.
    console.warn(
      `[track/click] refused (${verdict.reason}) t=${trackingId ?? "none"}: ${targetUrl.slice(0, 200)}`,
    );
    const message = verdict.reason === "unparseable" ? "Invalid URL" : "Untrusted URL";
    return NextResponse.json({ error: message }, { status: 400 });
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
