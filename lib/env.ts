/**
 * lib/env.ts — the one place that reads server-side environment variables.
 *
 * Why this exists: a var read raw at its point of use (`process.env.RESEND_API_KEY`
 * deep in a send) is only discovered MISSING at that moment, in a request — which
 * is exactly how a mis-scoped key becomes a production incident nobody saw coming.
 * Here every server var is DECLARED once (so a typo has a second reference to
 * disagree with), read through a validating accessor (so "missing" fails loud and
 * named, never as the literal string "undefined"), and the required set can be
 * asserted at boot / from a health check rather than at first use.
 *
 * NOT for `NEXT_PUBLIC_*`. Those are inlined into the CLIENT bundle by the Next.js
 * compiler, which only works on a literal `process.env.NEXT_PUBLIC_X` member
 * access — routing them through a function would leave `undefined` in the browser.
 * Read those inline; they are client-safe by definition.
 *
 * NOT for CRON_SECRET or AUDIT_IP_HMAC_KEY either — those have their own guarded
 * single readers (lib/cron/with-cron-run.ts, lib/audit.ts) and must stay there.
 */

/** A server var that MUST be present in production — its absence is an outage. */
const REQUIRED_IN_PROD = [
  "DATABASE_URL", // Prisma / pooler
  "NEXT_PUBLIC_SUPABASE_URL", // also read literally in client constructors
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", // admin auth, server-only
  // Field-level PII encryption (lib/encryption.ts, applied by the Prisma extension
  // to student.phone/address/emergencyContact/adminNotes, booking.clientPhone/notes,
  // intake free-text and the consent IP/user-agent columns).
  //
  // It sat in OPTIONAL, which was wrong in a way that hid itself: `encrypt()` THROWS
  // without the key, but `decrypt()` catches the same failure and returns the raw
  // ciphertext. So losing this var does not read as "integration off" — every client
  // and booking WRITE breaks, while every PII field silently renders as
  // `iv:tag:ciphertext` in the admin UI, in emails and in PDFs. Required, so
  // missingRequiredEnv() names it from the daily cron instead.
  "ENCRYPTION_KEY",
] as const;

/**
 * Server vars that gate an OPTIONAL integration. Absent is fine — the feature is
 * simply off — but the reader must handle that, never assume presence. Each is
 * surfaced to the admin as an `xConfigured` boolean elsewhere.
 */
const OPTIONAL = [
  "RESEND_API_KEY",
  "RESEND_FROM",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "MS_GRAPH_TENANT_ID",
  "MS_GRAPH_CLIENT_ID",
  "MS_GRAPH_CLIENT_SECRET",
  "MS_GRAPH_USER_EMAIL",
  "PAYSTACK_SECRET_KEY",
  "WHATSAPP_ACCESS_TOKEN",
  "BUNNY_STORAGE_ZONE_NAME",
  "BUNNY_STORAGE_API_KEY",
  "BUNNY_STORAGE_REGION",
  "BUNNY_STREAM_LIBRARY_ID",
  "BUNNY_STREAM_API_KEY",
  "BUNNY_ACCOUNT_API_KEY",
  "ADMIN_EMAIL",
] as const;

type RequiredVar = (typeof REQUIRED_IN_PROD)[number];
type OptionalVar = (typeof OPTIONAL)[number];
export type ServerVar = RequiredVar | OptionalVar;

/**
 * Read a server var, or `undefined` if unset. The only value in going through
 * here rather than `process.env` directly is that the NAME is checked against the
 * declared set at the type level — a typo won't compile.
 */
export function env(name: ServerVar): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

/**
 * Read a server var, or THROW a named error if it is missing. Use for a value the
 * code genuinely cannot proceed without — the throw is the point, so the failure
 * is loud and specific instead of a downstream `fetch(undefined)`.
 */
export function requireEnv(name: ServerVar): string {
  const v = env(name);
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

/** Read a server var, or a supplied default. For genuine config (a port, a region). */
export function envOr(name: ServerVar, fallback: string): string {
  return env(name) ?? fallback;
}

/**
 * Is an integration configured? True only when ALL of its vars are present — so a
 * half-set integration reads as off, not as a runtime error mid-request.
 */
export function isConfigured(...names: ServerVar[]): boolean {
  return names.every((n) => env(n) !== undefined);
}

/**
 * Assert every REQUIRED_IN_PROD var is present. Call from a health check or at
 * boot: it returns the list of missing names (empty = healthy) rather than
 * throwing, so a health endpoint can report all of them at once instead of dying
 * on the first. In development a missing var is expected, so callers typically
 * only enforce this when NODE_ENV === "production".
 */
export function missingRequiredEnv(): RequiredVar[] {
  return REQUIRED_IN_PROD.filter((n) => env(n) === undefined);
}

/** Every declared server var, required + optional. The union's runtime shadow —
 *  useful for a settings/health view that wants to enumerate them. */
export const ALL_SERVER_VARS: readonly ServerVar[] = [...REQUIRED_IN_PROD, ...OPTIONAL];
