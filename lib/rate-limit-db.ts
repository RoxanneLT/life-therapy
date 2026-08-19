/**
 * Durable rate limiting backed by the `rate_limits` table.
 *
 * Unlike the in-memory limiter (lib/rate-limit.ts), this survives serverless cold
 * starts and is shared across instances — so a login/reset lockout actually holds
 * on Vercel. Fixed-window counter; windowEnd doubles as the lockout expiry.
 *
 * There's a small read-then-write race, which is fine for brute-force defence
 * (worst case a couple of extra attempts slip through before the window opens).
 * Server-only (uses node:crypto + Prisma).
 */
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Privacy-preserving bucket key for an identifier (e.g. email) — never store it raw. */
function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/**
 * The bucket key for a rate-limited attempt. Use this rather than building a
 * template literal per call site.
 *
 * `rate_limits.key` is the PRIMARY KEY, so whatever goes in it is stored in
 * plaintext and readable by anyone with database access. Half the call sites
 * hashed the identifier and half interpolated it raw, which left rows like
 * `login:ip:165.0.85.107` and `pwreset:ip:41.123.46.150` sitting in the table —
 * a log of who tried to sign in and from where, in a table nobody thinks of as
 * holding personal data, next to an audit trail that HMACs its IPs precisely so
 * they cannot be read back.
 *
 * There is no case for the raw value: the key only ever needs to be equal to
 * itself.
 */
export function limitKey(scope: string, kind: "ip" | "email" | "user", value: string): string {
  return `${scope}:${kind}:${hashIdentifier(value)}`;
}

/** True when the key has reached its limit inside the current (unexpired) window. */
export async function isRateLimitedDb(key: string, limit: number): Promise<boolean> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowEnd <= new Date()) return false;
  return row.count >= limit;
}

/**
 * Check-and-record in one call, for the public write endpoints.
 *
 * Returns `true` when the caller is OVER the limit (and records nothing further).
 * Otherwise records the hit and returns `false`.
 *
 * Use this — not lib/rate-limit.ts — for anything that creates a real record. The
 * in-memory limiter keeps its counter in a `Map` inside one lambda, so on Vercel
 * each warm instance has its own: the effective ceiling is `limit × instances`,
 * and it resets on every cold start. That is fine for bounding scrapers; it is not
 * a limit on something that takes a slot in a finite calendar.
 */
export async function checkAndRecord(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  if (await isRateLimitedDb(key, limit)) return true;
  await recordHitDb(key, windowMs);
  return false;
}

const HOUR_MS = 60 * 60 * 1000;

/** Public booking creation: 10/hr/IP, durable. Takes a real slot in a real diary. */
export async function rateLimitBookingDb(ip: string): Promise<boolean> {
  return checkAndRecord(limitKey("booking", "ip", ip), 10, HOUR_MS);
}

/** Portal self-registration: 5/hr/IP, durable. */
export async function rateLimitRegisterDb(ip: string): Promise<boolean> {
  return checkAndRecord(limitKey("register", "ip", ip), 5, HOUR_MS);
}

/** Newsletter signup: 3/hr/IP. It upserts a real student row — see the route. */
export async function rateLimitNewsletterDb(ip: string): Promise<boolean> {
  return checkAndRecord(limitKey("newsletter", "ip", ip), 3, HOUR_MS);
}

/**
 * Drop rate-limit rows whose window has closed.
 *
 * They are spent counters with no meaning once expired, and every one of them
 * carries an identifier. Keeping them is retaining personal data to no purpose,
 * which is the part POPIA minds — not the row count.
 */
export async function pruneExpiredRateLimits(): Promise<{ pruned: number }> {
  const res = await prisma.rateLimit.deleteMany({
    where: { windowEnd: { lt: new Date() } },
  });
  return { pruned: res.count };
}

/** Count one hit — opens a fresh window if none/expired, otherwise increments. */
export async function recordHitDb(key: string, windowMs: number): Promise<void> {
  const now = new Date();
  const existing = await prisma.rateLimit.findUnique({ where: { key } });
  if (!existing || existing.windowEnd <= now) {
    const windowEnd = new Date(now.getTime() + windowMs);
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, windowEnd },
      update: { count: 1, windowEnd },
    });
  } else {
    await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  }
}

/** Clear a key's counter (e.g. on a successful login or after a verified reset). */
export async function clearRateLimitDb(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}
