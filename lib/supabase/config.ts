/**
 * Shared Supabase session / cookie configuration.
 *
 * The proxy re-sets cookies on every request, so `maxAge` is effectively
 * an **inactivity timeout** — if the user doesn't visit for this long,
 * they're logged out and must sign in again.
 *
 * Clients: 30 days inactivity (generous — they visit infrequently).
 * Admins:  8 hours inactivity on /admin routes (separate cookie below).
 */

/** Client inactivity timeout: 30 days */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Admin-specific inactivity timeout (8 hours).
 * Tracked via a separate cookie (`lt-admin-active`) that is ONLY refreshed
 * when the request is to an /admin route. Browsing public pages does NOT
 * reset this timer, so admins are genuinely logged out after idle time.
 */
export const ADMIN_INACTIVITY_SECONDS = 60 * 60 * 8;
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
