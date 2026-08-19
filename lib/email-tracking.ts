/**
 * Click/open tracking injection — the pure core, extracted so it can be tested
 * without standing up Prisma, Resend and nodemailer. `lib/email.ts` is the only
 * caller.
 *
 * Why this file exists at all: the wrapper and the click redirector
 * (`app/api/track/click/route.ts`) enforce two halves of ONE rule. The
 * redirector was hardened to forward only to our own hosts — correctly; it had
 * been an open redirector on the practice's own domain. But the wrapper went on
 * wrapping every link in every email, including the Teams "Join your session"
 * link, so the hardening turned each of those into a client-facing page reading
 * `{"error":"Untrusted URL"}`. Both halves now read `isOurHost` from
 * lib/region.ts. Neither may keep its own copy (§6, 2026-08-19).
 */
import { isOurHost } from "@/lib/region";

/**
 * Would the click redirector forward this URL?
 *
 * Unparseable is not trackable: the redirector answers `{"error":"Invalid URL"}`
 * to those, so wrapping one produces the same dead end by a different message.
 */
export function isTrackableTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && isOurHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** Inject a 1x1 tracking pixel and wrap links for click tracking. */
export function injectTracking(html: string, trackingId: string, baseUrl: string): string {
  let tracked = html.replaceAll(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url: string) => {
      if (url.includes("/api/unsubscribe") || url.includes("/api/track/")) {
        return `href="${url}"`;
      }
      // Only wrap what the redirector will actually forward. It accepts our own
      // hosts and nothing else (deliberately — see app/api/track/click), so a
      // wrapped Teams or Paystack link is a link that resolves to
      // `{"error":"Untrusted URL"}` in the client's browser. An external link
      // simply goes out untracked; losing a click statistic beats losing the
      // click.
      if (!isTrackableTarget(url)) {
        return `href="${url}"`;
      }
      const encoded = encodeURIComponent(url);
      return `href="${baseUrl}/api/track/click?t=${trackingId}&url=${encoded}"`;
    }
  );

  const pixel = `<img src="${baseUrl}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;border:0;" alt="" />`;
  if (tracked.includes("</body>")) {
    tracked = tracked.replace("</body>", `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  return tracked;
}
