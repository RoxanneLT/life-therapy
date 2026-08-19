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

/**
 * The READER's decision, kept in this file alongside the writer's on purpose:
 * they are two halves of one rule, and the whole incident was them living apart.
 *
 * `isTrackableTarget` above governs what we WRAP. This governs what we FORWARD,
 * and the two are deliberately NOT the same predicate:
 *
 *   - We never wrap an external link again. Not one.
 *   - But links already wrapped are sitting in clients' inboxes, frozen, and no
 *     server-side change reaches them. Nineteen went out over two days, most
 *     carrying the Teams "Join your session" link.
 *
 * So the reader forgives what the writer will never again produce: a foreign
 * destination is forwarded ONLY if it exactly matches a Teams URL already stored
 * on a booking. That is not an allowlist of hosts — it is a lookup against data
 * we hold, which is what keeps this from becoming an open redirector again. An
 * attacker cannot invent a destination; they would have to already possess a
 * real meeting URL, and if they did they would not need us to redirect to it.
 *
 * The one thing it leaks is an oracle: `?url=X` answering 302 rather than 400
 * confirms X is one of our meetings. To ask the question you must already hold
 * the exact URL, which IS the secret — so the answer tells you only what you
 * brought with you.
 *
 * Do NOT "simplify" this into `hostname === "teams.microsoft.com"`. That is the
 * open redirector again, wearing this comment as cover.
 */
export type TrackedTargetVerdict =
  | { forward: true; reason: "our-host" | "known-meeting" }
  | { forward: false; reason: "unparseable" | "bad-protocol" | "untrusted" };

export async function classifyTrackedTarget(
  raw: string,
  isKnownMeetingUrl: (url: string) => Promise<boolean>,
): Promise<TrackedTargetVerdict> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { forward: false, reason: "unparseable" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { forward: false, reason: "bad-protocol" };
  }
  if (isOurHost(parsed.hostname)) {
    return { forward: true, reason: "our-host" };
  }
  // Legacy inbox repair only — reached by links sent 2026-08-17 … 2026-08-19.
  // Exact string match: the stored values were verified to carry no `&`, no HTML
  // entities and no stray whitespace, so the value round-trips through the email
  // and back unchanged. A near-miss falls through to the same refusal as before,
  // so the worst case is the behaviour we already had.
  if (await isKnownMeetingUrl(raw)) {
    return { forward: true, reason: "known-meeting" };
  }
  return { forward: false, reason: "untrusted" };
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
