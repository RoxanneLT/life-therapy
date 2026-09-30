"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { safeNextPath } from "@/lib/safe-redirect";
import { stepUpWithTotp } from "@/lib/mfa-step-up";

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

  // Rate limit, verify and audit live in lib/mfa-step-up.ts, shared with the
  // password reset so both draw on one allowance of guesses.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const stepUp = await stepUpWithTotp(supabase, user, code, ip);
  if (stepUp.error) return { error: stepUp.error };

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
