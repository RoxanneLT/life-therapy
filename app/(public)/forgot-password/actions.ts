"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { emailPasswordLink } from "@/lib/account-link";
import { recordAuthEvent } from "@/lib/audit";
import { isRateLimitedDb, recordHitDb, clearRateLimitDb, limitKey } from "@/lib/rate-limit-db";
import { appBaseUrl } from "@/lib/region";

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

  try {
    // The core is shared with registration: lib/account-link.ts. It links nothing; the student row
    // is linked to its login in updatePasswordAction below, once the emailed token is spent.
    const result = await emailPasswordLink(
      email,
      (link) => ({ templateKey: "password_reset", variables: { resetUrl: link } }),
      BASE_URL,
    );
    if (!result.ok) return { error: result.error };
    if (result.sent) {
      await recordAuthEvent({
        action: "password_reset_requested",
        email,
        ip: clientIp(await headers()),
        userId: result.authUserId,
      });
    }
  } catch (err) {
    console.error(`[password-reset] Unexpected error:`, err);
    return { error: "Something went wrong. Please try again later." };
  }

  return { success: true };
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

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  const h = await headers();
  const ip = clientIp(h);
  const { data: { user } } = await supabase.auth.getUser();
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
