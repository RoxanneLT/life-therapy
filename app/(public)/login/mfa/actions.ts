"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";

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
    return { error: "That code wasn't accepted. Check your authenticator and try again." };
  }

  // Session is now AAL2 and the cookies are set on this response. Resolve the
  // destination server-side and redirect (Set-Cookie travels with the redirect).
  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
    select: { id: true },
  });
  if (adminUser) {
    redirect("/admin");
  }

  const dest =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("/admin")
      ? redirectTo
      : "/portal";
  redirect(dest);
}
