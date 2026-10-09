import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
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
 * The query-string suffix a recovery link carries so the reset page knows to ask for a 2FA code:
 * `"&mfa=1"` for an account with a verified TOTP factor, `""` otherwise. Every sender of a
 * `/reset-password?token_hash=` link appends it.
 *
 * Why the link and not the page: the page cannot find out, because learning which account a token
 * belongs to means spending it, and spending it on load is what lets a mail scanner burn it. The
 * sender already knows the account. Without this, the page had to show the code field to everyone
 * and make people remember whether they had turned 2FA on — and a wrong guess cost the link.
 *
 * It is a HINT, never an authority: updatePasswordAction checks the factor itself and refuses a
 * 2FA account without a code whatever the URL says. Stripping it gets a refusal, not a bypass. It
 * tells a reader of the email whether the account has 2FA, and that reader already holds the mailbox.
 *
 * Fails to `""`: an unreadable factor list shows no field, the server still refuses, and the
 * refusal says to request a new link. Showing the field to everyone on an error would bring back
 * the question this exists to remove.
 */
export async function recoveryLinkMfaHint(userId: string | null | undefined): Promise<string> {
  if (!userId) return "";
  try {
    const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId });
    if (error) {
      console.error(`[mfa-hint] listFactors failed for ${userId}:`, error.message);
      return "";
    }
    return data?.factors?.some((f) => f.factor_type === "totp" && f.status === "verified") ? "&mfa=1" : "";
  } catch (err) {
    console.error(`[mfa-hint] listFactors threw for ${userId}:`, err);
    return "";
  }
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

/**
 * Fresh proof of the second factor, for one admin action that grants access, removes it, or
 * removes another admin's 2FA. The caller passes the code the person just typed.
 *
 * Why a signed-in super_admin is not enough (shape from Pleks's lib/auth/step-up.ts): the session
 * proved 2FA once, at sign-in, possibly days ago, on a desk others can reach, and the 2FA gate
 * fails open when the assurance lookup errors (lib/auth.ts). These actions are how a borrowed
 * session would make itself permanent: invite an account, promote it, delete the real owner, or
 * strip a colleague's 2FA. A code typed now proves the authenticator is in hand now.
 *
 * Pleks issues a single-use token after the challenge, because its actions span several requests.
 * Each action here is one request, so the code is checked inside it and there is nothing to store.
 * Shares stepUpWithTotp's rate-limit buckets, so this is not a second allowance of guesses.
 */
export async function confirmWithTotp(code: FormDataEntryValue | string | null | undefined): Promise<{ error?: string }> {
  if (typeof code !== "string" || !code.trim()) {
    return { error: "Enter the 6-digit code from your authenticator app to confirm this." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has ended. Sign in again." };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return stepUpWithTotp(supabase, { id: user.id, email: user.email }, code, ip);
}
