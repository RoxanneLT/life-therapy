"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { safeNextPath } from "@/lib/safe-redirect";
import { isRateLimitedDb, recordHitDb, clearRateLimitDb, limitKey } from "@/lib/rate-limit-db";
import { recordAuthEvent } from "@/lib/audit";

/** Five tries per quarter-hour, matching the password path's IP allowance. */
const MFA_LIMIT = 5;
const MFA_WINDOW_MS = 15 * 60 * 1000;

/**
 * Verify a TOTP code on the SERVER so the AAL2 session is written to cookies
 * atomically in this response. Doing the verify client-side races: the browser
 * reaches AAL2 but the cookie write (an async auth-state event) can land AFTER
 * the redirect to /admin fires, so the server still reads AAL1 and bounces back
 * to /login/mfa — an endless loop. Here the redirect carries the AAL2 Set-Cookie,
 * so /admin sees AAL2 on the very next request.
 */
export async function verifyMfaAction(
  code: string,
  redirectTo?: string,
): Promise<{ error?: string }> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // A TOTP code is six digits and the current one stays valid for ~30-90s, so
  // the whole defence rests on how many guesses fit inside that window. There
  // was no app-level limit at all here: the password had one, the second factor
  // — the half that is supposed to survive a stolen password — had none.
  //
  // Keyed on the user id first, because by this point the session is already
  // authenticated to AAL1 and identity is known; the IP bucket is the secondary
  // net for one source working through many accounts.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const userKey = limitKey("mfa", "user", user.id);
  const ipKey = limitKey("mfa", "ip", ip);

  if ((await isRateLimitedDb(userKey, MFA_LIMIT)) || (await isRateLimitedDb(ipKey, MFA_LIMIT))) {
    await recordAuthEvent({
      action: "mfa_failure",
      email: user.email ?? "unknown",
      ip,
      userId: user.id,
      reason: "rate_limited",
    });
    return { error: "Too many attempts. Please wait 15 minutes and try again." };
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.find((f) => f.status === "verified");
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
    await recordAuthEvent({
      action: "mfa_failure",
      email: user.email ?? "unknown",
      ip,
      userId: user.id,
      reason: "invalid_code",
    });
    return { error: "That code wasn't accepted. Check your authenticator and try again." };
  }

  // Cleared on success so a person who fat-fingers a few codes and then gets it
  // right is not left sitting in a lockout they have already escaped.
  await clearRateLimitDb(userKey);
  await clearRateLimitDb(ipKey);
  await recordAuthEvent({
    action: "mfa_success",
    email: user.email ?? "unknown",
    ip,
    userId: user.id,
  });

  // Session is now AAL2 and the cookies are set on this response. Resolve the
  // destination server-side and redirect (Set-Cookie travels with the redirect).
  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true },
  });
  if (adminUser) {
    redirect("/admin");
  }

  // `startsWith("/")` alone admits "//evil.com", which a browser reads as
  // protocol-relative and follows off-origin. safeNextPath is the shared guard.
  const safe = safeNextPath(redirectTo, "/portal");
  redirect(safe.startsWith("/admin") ? "/portal" : safe);
}
