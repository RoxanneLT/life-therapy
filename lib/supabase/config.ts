/**
 * Shared Supabase session / cookie configuration.
 *
 * The proxy re-sets cookies on every request, so `maxAge` is effectively
 * an **inactivity timeout** — if the user doesn't visit for this long,
 * they're logged out and must sign in again.
 *
 * Clients: 14 days inactivity (was 30 — shorter session, still fine for
 *          infrequent visitors; sensitive portal data shouldn't linger a month).
 * Admins:  capped tighter by ADMIN_INACTIVITY_SECONDS below.
 */

/** Client inactivity timeout: 14 days */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

/**
 * Admin-specific inactivity timeout (7 days).
 * Tracked via a separate cookie (`lt-admin-active`) that is ONLY refreshed
 * when the request is to an /admin route. Browsing public pages does NOT
 * reset this timer, so admins are genuinely logged out after idle time.
 *
 * Set to a week so a 2FA-enabled admin re-enters their authenticator code about
 * weekly rather than daily — the session stays AAL2 (MFA-verified) for its life.
 */
export const ADMIN_INACTIVITY_SECONDS = 60 * 60 * 24 * 7;
export const ADMIN_ACTIVITY_COOKIE = "lt-admin-active";

/** Dev inactivity timeout (5 min). Proxy refreshes on every request,
 *  so this only expires when the dev server is stopped for 5+ minutes. */
const DEV_MAX_AGE_SECONDS = 60 * 5;

export const COOKIE_OPTIONS = {
  maxAge:
    process.env.NODE_ENV === "production"
      ? SESSION_MAX_AGE_SECONDS
      : DEV_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
