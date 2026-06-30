/**
 * Simple in-memory rate limiter for serverless environments.
 * Resets on cold starts, which is acceptable — it prevents abuse
 * during sustained attacks without requiring external infrastructure.
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

export function rateLimit(
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

/**
 * Read-only check — is this key currently at/over the limit? Does NOT increment.
 * Pair with recordHit() to count only the events you care about (e.g. failed
 * logins, so successful sign-ins don't burn the allowance).
 */
export function isRateLimited(key: string, limit: number): boolean {
  const entry = store.get(key);
  if (!entry || Date.now() > entry.resetAt) return false;
  return entry.count >= limit;
}

/** Count one hit against the key, opening or extending its window. */
export function recordHit(key: string, windowMs: number): void {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
  } else {
    entry.count++;
  }
}

/** Clear a key's counter (e.g. on a successful login). */
export function clearRateLimit(key: string): void {
  store.delete(key);
}

// Pre-configured limiters
export function rateLimitLogin(ip: string) {
  return rateLimit(`login:${ip}`, 5, 15 * 60 * 1000); // 5 attempts per 15 min
}

export function rateLimitBooking(ip: string) {
  return rateLimit(`booking:${ip}`, 10, 60 * 60 * 1000); // 10 bookings per hour
}

export function rateLimitApi(ip: string) {
  return rateLimit(`api:${ip}`, 60, 60 * 1000); // 60 requests per minute
}

export function rateLimitNewsletter(ip: string) {
  return rateLimit(`newsletter:${ip}`, 3, 60 * 60 * 1000); // 3 per hour
}

export function rateLimitStudentLogin(ip: string) {
  return rateLimit(`student-login:${ip}`, 5, 15 * 60 * 1000); // 5 attempts per 15 min
}

export function rateLimitStudentRegister(ip: string) {
  return rateLimit(`register:${ip}`, 5, 60 * 60 * 1000); // 5 per hour
}
