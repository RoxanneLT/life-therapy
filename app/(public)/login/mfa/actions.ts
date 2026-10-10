"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { safeNextPath } from "@/lib/safe-redirect";
import { stepUpWithTotp } from "@/lib/mfa-step-up";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { recordAudit } from "@/lib/audit";
import { sendSecurityNotice } from "@/lib/security-notice";

/**
 * An admin added or removed their OWN second factor. Both happen in the browser
 * (components/admin/mfa-setup.tsx, against Supabase directly), so until 2026-10-10 neither left an
 * audit row or told anyone. A takeover that swaps the authenticator was invisible to the owner
 * (pleks security comparison, item 3). The client calls this after the change succeeds.
 *
 * The claim is checked against Supabase, not taken from the browser: "added" with no verified
 * factor records and sends nothing. A forged "removed" can only mail the caller's own inbox.
 * skipMfaGate, because the setup page is where an admin with no factor yet has to be.
 */
export async function recordOwnMfaChangeAction(change: "added" | "removed"): Promise<{ error?: string }> {
  const { user, adminUser } = await getAuthenticatedAdmin({ skipMfaGate: true });

  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  if (error) return { error: error.message };
  const verified = (data?.factors ?? []).filter((f) => f.status === "verified").length;
  if (change === "added" && verified === 0) return {};

  await recordAudit({
    action: change === "added" ? "admin_mfa_enrolled" : "admin_mfa_self_removed",
    entityType: "admin_user",
    entityId: adminUser.id,
    actorEmail: adminUser.email,
    metadata: { verifiedFactors: verified },
  });
  await sendSecurityNotice(
    adminUser.email,
    adminUser.name,
    change === "added"
      ? "An authenticator app was just added to your Life-Therapy admin account for two-factor sign-in. If this wasn't you, contact us straight away."
      : "Two-factor sign-in was just removed from your Life-Therapy admin account. If this wasn't you, contact us straight away.",
  );
  return {};
}

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
