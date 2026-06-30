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
export function hashIdentifier(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/** True when the key has reached its limit inside the current (unexpired) window. */
export async function isRateLimitedDb(key: string, limit: number): Promise<boolean> {
  const row = await prisma.rateLimit.findUnique({ where: { key } });
  if (!row || row.windowEnd <= new Date()) return false;
  return row.count >= limit;
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
