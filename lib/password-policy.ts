/**
 * The password rule this app checks before handing a new password to Supabase. One value, read by
 * every form and action that SETS a password, client and server alike — so this module imports
 * nothing server-only.
 *
 * Until 2026-10-09 the minimum was written into each site: 8 on the admin, reset and first-login
 * paths, 6 on portal Settings and gift redemption, and the gift action checked nothing on the server.
 * Supabase's own floor (`password_min_length` in the project's auth config) was 6 when read that day,
 * so Supabase alone would still accept a 6-character password from a direct API call.
 *
 * Not the rule for SIGNING IN: an existing password shorter than this still works and must, so
 * login forms never check it. (`loginSchema` in lib/validations.ts carries its own, unadopted, 12.)
 */
export const MIN_PASSWORD_LENGTH = 8;

/** The refusal for a password too short to set, or null when it is long enough. */
export function passwordLengthRefusal(password: string | null | undefined): string | null {
  return !password || password.length < MIN_PASSWORD_LENGTH
    ? `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    : null;
}
