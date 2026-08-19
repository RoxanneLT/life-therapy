/**
 * In-memory rate limiting. ONE limiter survives here, for one job.
 *
 * ── Read this before adding another ──────────────────────────────────────────
 * This module is per-process, and on Vercel each serverless invocation may be a
 * fresh process. So the counter an attacker has to exhaust is not "5 attempts",
 * it is "5 attempts per lambda they happen to land on" — which is why every
 * security-critical path moved to `lib/rate-limit-db.ts`, whose counters live in
 * the database and are shared across invocations.
 *
 * Nine exports were deleted on 2026-08-19: `rateLimit`, `isRateLimited`,
 * `recordHit`, `clearRateLimit`, and the pre-configured `rateLimitLogin`,
 * `rateLimitBooking`, `rateLimitNewsletter`, `rateLimitStudentLogin`,
 * `rateLimitStudentRegister`. Every one had zero callers, and every path they
 * named already had a durable equivalent — login, MFA, forgot-password,
 * registration, booking, newsletter and coupon validation all call
 * `rate-limit-db`. Verified per path before removal, not assumed.
 *
 * They were worse than ordinary dead code. A function called `rateLimitLogin`
 * reads as the thing protecting login; the next person to need a limiter would
 * have imported it by name and shipped a control that silently does almost
 * nothing on serverless. Dead code that looks like a security control is a trap
 * with a friendly label.
 *
 * `rateLimitApi` stays because two availability endpoints call it, and its job is
 * coarse politeness on read-only routes rather than abuse prevention. It carries
 * the same weakness — if it ever guards something that matters, move it to
 * `rate-limit-db` rather than trusting this store.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key);
  });
}, 60_000);

function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

/** Coarse per-process politeness for read-only availability endpoints. */
export function rateLimitApi(ip: string) {
  return rateLimit(`api:${ip}`, 60, 60 * 1000); // 60 requests per minute
}
