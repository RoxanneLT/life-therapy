"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { emailPasswordLink } from "@/lib/account-link";
import { recordAuthEvent } from "@/lib/audit";
import { isRateLimitedDb, recordHitDb, clearRateLimitDb, limitKey } from "@/lib/rate-limit-db";
import { appBaseUrl } from "@/lib/region";
import { stepUpWithTotp, verifiedTotpFactor } from "@/lib/mfa-step-up";

const RESET_WINDOW_MS = 15 * 60 * 1000;

function clientIp(h: Headers): string | undefined {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}

const BASE_URL =
  appBaseUrl();

interface ResetState {
  error?: string;
  success?: boolean;
}

export async function requestPasswordResetAction(
  _prevState: ResetState | null,
  formData: FormData,
): Promise<ResetState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    return { error: "Please enter your email address." };
  }

  // Throttle reset requests (anti reset-bombing): 5 per IP and 3 per target email
  // per 15 min. Counted before any account lookup, so it can't be used to enumerate.
  const reqIp = clientIp(await headers()) ?? "unknown";
  const ipKey = limitKey("pwreset", "ip", reqIp);
  const emailKey = limitKey("pwreset", "email", email);
  if ((await isRateLimitedDb(ipKey, 5)) || (await isRateLimitedDb(emailKey, 3))) {
    return { error: "Too many reset requests. Please wait a few minutes and try again." };
  }
  await recordHitDb(ipKey, RESET_WINDOW_MS);
  await recordHitDb(emailKey, RESET_WINDOW_MS);

  // The core is shared with registration: lib/account-link.ts. It links nothing; the student row
  // is linked to its login in updatePasswordAction below, once the emailed token is spent.
  //
  // It runs in `after`, once the answer has gone out, for the reason registration gives: an address
  // with no account returns at once, one with an account builds a link and sends an email, and the
  // difference is measurable from outside. The same message at the same speed says nothing. A
  // failed send is logged, not shown; showing it would say that the address has an account.
  after(async () => {
    try {
      const result = await emailPasswordLink(
        email,
        (link) => ({ templateKey: "password_reset", variables: { resetUrl: link } }),
        BASE_URL,
      );
      if (!result.ok) {
        console.error(`[password-reset] no link sent to ${email}: ${result.error}`);
        return;
      }
      if (result.sent) {
        await recordAuthEvent({
          action: "password_reset_requested",
          email,
          ip: reqIp === "unknown" ? undefined : reqIp,
          userId: result.authUserId,
        });
      }
    } catch (err) {
      console.error(`[password-reset] Unexpected error:`, err);
    }
  });

  return { success: true };
}

/** Why a reset must stop for want of a 2FA code, or null when it may proceed. */
async function secondFactorRefusal(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: { id: string; email?: string },
  formData: FormData,
  ip: string | undefined,
): Promise<string | null> {
  if (!(await verifiedTotpFactor(supabase))) return null;

  const mfaCode = ((formData.get("mfa_code") as string) || "").replace(/\D/g, "");
  if (mfaCode.length !== 6) {
    return "Your account uses two-factor authentication, so the 6-digit code from your authenticator app is needed too. This link has now been used — please request a new one and enter the code with your new password.";
  }
  const stepUp = await stepUpWithTotp(supabase, user, mfaCode, ip ?? "unknown");
  return stepUp.error ? `${stepUp.error} This link has now been used — please request a new one.` : null;
}

export async function updatePasswordAction(
  _prevState: ResetState | null,
  formData: FormData,
): Promise<ResetState> {
  const newPassword = formData.get("new_password") as string;
  const tokenHash = (formData.get("token_hash") as string) || "";

  if (!newPassword) {
    return { error: "Please enter a new password." };
  }

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();

  // THE TOKEN IS THE ONLY AUTHORITY HERE (dev-standards/ledgers/LESSONS.md L-72). Until
  // 2026-09-10 a submit with no token fell through to `updateUser` on whatever session was
  // signed in: a password set with no current password, on a session alone. That existed for
  // links routed through /auth/callback, which spends the token and arrives with a bare session.
  // Every sender now links straight here with its token (forgot-password, admin invites,
  // campaigns, drip). An old callback-routed link that is still valid gets the refusal below,
  // and one request from Forgot password replaces it. Signed-in changes go through Settings,
  // which verifies the current password.
  if (!tokenHash) {
    return {
      error: "This reset link has expired or already been used. Please request a new one.",
    };
  }

  // Verify the recovery token NOW — on the user's submit, not on a GET — so an
  // email-link scanner that pre-fetched the link couldn't have consumed it first.
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });
  if (verifyError) {
    console.error("[password-reset] verifyOtp failed:", verifyError.message);
    return {
      error: "This reset link has expired or already been used. Please request a new one.",
    };
  }

  const h = await headers();
  const ip = clientIp(h);
  const { data: { user } } = await supabase.auth.getUser();

  // A recovery token yields an AAL1 session, and Supabase refuses a password change on an
  // account with 2FA until the session is AAL2 ("AAL2 session is required to update email or
  // password when MFA is enabled") — which is what every 2FA account saw here until 2026-09-30.
  // The token proves the mailbox, the code proves the authenticator; a reset needs both, or a
  // stolen inbox would be enough to take an account whose owner turned 2FA on to prevent that.
  //
  // The token is already spent by this point and cannot be re-used, so a missing or wrong code
  // costs the link. The form cannot ask only 2FA accounts for a code: knowing which accounts have
  // one would need the token verified first, and verifying on page load is what lets a mail
  // scanner burn it. So the field is shown to everyone, and the refusal says a new link is needed.
  if (user) {
    const refusal = await secondFactorRefusal(supabase, user, formData, ip);
    if (refusal) return { error: refusal };
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  if (user) {
    // The token was just spent, so THIS is when the address is proven, and when a student row is
    // linked to its login. lib/account-link.ts deliberately links nothing when the email is sent.
    // Whatever temporary password the account held is replaced, so the forced-change flag goes too.
    // Until 2026-09-11 it stayed set, and sent a person who had just chosen a password to choose
    // another one.
    await prisma.student.updateMany({
      where: { supabaseUserId: user.id, mustChangePassword: true },
      data: { mustChangePassword: false },
    });
    if (user.email) {
      try {
        await prisma.student.updateMany({
          where: { email: { equals: user.email, mode: "insensitive" }, supabaseUserId: null },
          data: { supabaseUserId: user.id, mustChangePassword: false },
        });
      } catch (err) {
        // Another student row already holds this login. The password is set; the link is not.
        console.error("[password-reset] could not link the student row:", err);
      }
    }
  }
  await recordAuthEvent({
    action: "password_changed",
    email: user?.email ?? "unknown",
    ip,
    userId: user?.id ?? null,
  });
  // They proved account control via the email link — clear any login lockout
  // (both the IP and this account's email bucket) so they can sign in immediately.
  if (ip) await clearRateLimitDb(limitKey("login", "ip", ip));
  if (user?.email) await clearRateLimitDb(limitKey("login", "email", user.email));

  return { success: true };
}
