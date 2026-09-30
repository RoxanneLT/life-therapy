import type { createSupabaseServerClient } from "@/lib/supabase-server";
import { isRateLimitedDb, recordHitDb, clearRateLimitDb, limitKey } from "@/lib/rate-limit-db";
import { recordAuthEvent } from "@/lib/audit";

type ServerSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** Five tries per quarter-hour, matching the password path's IP allowance. */
const MFA_LIMIT = 5;
const MFA_WINDOW_MS = 15 * 60 * 1000;

/** The account's verified TOTP factor, or null when it has no 2FA. */
export async function verifiedTotpFactor(supabase: ServerSupabase): Promise<{ id: string } | null> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return factors?.totp?.find((f) => f.status === "verified") ?? null;
}

/**
 * Raise a signed-in session to AAL2 with a TOTP code, on the SERVER so the AAL2
 * cookie is written in this response. Shared by the login 2FA screen and the
 * password reset, because Supabase refuses a password change on an MFA account
 * from an AAL1 session — and a recovery link only ever yields AAL1.
 *
 * A TOTP code is six digits and the current one stays valid for ~30-90s, so the
 * whole defence rests on how many guesses fit inside that window. Keyed on the
 * user id first, because the session is already authenticated to AAL1 and
 * identity is known; the IP bucket is the secondary net for one source working
 * through many accounts. Both callers share the buckets, so the reset form is not
 * a second allowance of guesses.
 */
export async function stepUpWithTotp(
  supabase: ServerSupabase,
  user: { id: string; email?: string },
  code: string,
  ip: string,
): Promise<{ error?: string }> {
  const userKey = limitKey("mfa", "user", user.id);
  const ipKey = limitKey("mfa", "ip", ip);
  const email = user.email ?? "unknown";

  if ((await isRateLimitedDb(userKey, MFA_LIMIT)) || (await isRateLimitedDb(ipKey, MFA_LIMIT))) {
    await recordAuthEvent({ action: "mfa_failure", email, ip, userId: user.id, reason: "rate_limited" });
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  const totp = await verifiedTotpFactor(supabase);
  if (!totp) {
    return { error: "No authenticator is set up on this account." };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: totp.id,
    code: code.trim(),
  });
  if (error) {
    await recordHitDb(userKey, MFA_WINDOW_MS);
    await recordHitDb(ipKey, MFA_WINDOW_MS);
    await recordAuthEvent({ action: "mfa_failure", email, ip, userId: user.id, reason: "invalid_code" });
    return { error: "That code wasn't accepted. Check your authenticator and try again." };
  }

  // Cleared on success so a person who fat-fingers a few codes and then gets it
  // right is not left sitting in a lockout they have already escaped.
  await clearRateLimitDb(userKey);
  await clearRateLimitDb(ipKey);
  await recordAuthEvent({ action: "mfa_success", email, ip, userId: user.id });
  return {};
}
