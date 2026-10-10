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
 * skipMfaGate, because the setup page is where an admin with no factor yet has to be, so a
 * password-only (AAL1) session reaches this. Neither claim is taken from the browser, or someone
 * holding only the password could write false rows into the audit trail this exists to make
 * trustworthy (walk-oct-security F3):
 * - "added" needs a verified factor CREATED in the last ADDED_WINDOW_MS. AAL1 cannot create one
 *   on an account that has a factor, because Supabase requires AAL2 for that. created_at and not
 *   updated_at, because a challenge (allowed at AAL1) may touch updated_at (walk-oct-security-2
 *   F3). The AAL is not asked for here: the browser's upgrade to AAL2 can reach the cookies after
 *   this call (see verifyMfaAction). The window is a day, not minutes: created_at is set when the
 *   QR is shown, not when it is confirmed. On an account that has a factor, a wider window gives
 *   an AAL1 caller nothing, because it cannot create one. On an account with none, AAL1 can
 *   enrol, and what it records is true. The worst a caller can do with the day is get a missed
 *   genuine enrolment recorded late, so the owner hears "just added" up to a day after the fact.
 *   The dedupe is by time, not factor id: no row written since the earliest fresh factor was
 *   created. That suffices because the page offers enrolment only when no factor is verified.
 * - "removed" needs no verified factor left AND an AAL2 session, because Supabase requires AAL2 to
 *   unenroll. The cookie JWT normally still reads aal2: auth-js's unenroll saves no session of its
 *   own. But every auth-js call refreshes a token within about 90 seconds of its expiry, and
 *   getUser() may do the same server-side. So if a refresh lands between the unenroll and this
 *   call, the result depends on GoTrue, which was not measured. If GoTrue downgrades the token,
 *   the real removal goes unrecorded. If it does not, a later repeat carries a new iat and is
 *   recorded a second time. Neither path writes a false row. Repeats: see removedIsNew.
 *
 * What this does NOT catch:
 * - A change made against Supabase directly, from a console or a script holding the session's
 *   token, never reaches this action.
 * - Removing one factor of two is not recorded either.
 * - A removal from a session whose token predates a super admin's reset is suppressed, even if
 *   that reset failed to delete the factor and the owner is now removing it for real.
 * It records what the setup page reports, and makes that report trustworthy. Seeing every change
 * would need the server to observe the factors itself.
 * Both dedupes are check-then-insert. Calls racing each other can record one true event twice,
 * never a false one.
 */
const ADDED_WINDOW_MS = 24 * 60 * 60 * 1000;

/** A verified factor created inside the window, and no enrolment row since it. */
async function addedIsNew(adminUserId: string, createdAts: string[]): Promise<boolean> {
  const since = Date.now() - ADDED_WINDOW_MS;
  const fresh = createdAts.map((at) => Date.parse(at)).filter((t) => Number.isFinite(t) && t >= since);
  if (fresh.length === 0) return false;
  const already = await prisma.auditLog.findFirst({
    where: { action: "admin_mfa_enrolled", entityId: adminUserId, createdAt: { gte: new Date(Math.min(...fresh)) } },
    select: { id: true },
  });
  return !already;
}

/**
 * An AAL2 session, and not a repeat: no removal row (own or a super admin's) written after this
 * session's access token was issued. A token that outlived a removal is the one way a session with
 * no factor still reads aal2. So a repeat from it, or the target's session after a super admin's
 * reset, is suppressed for exactly as long as that token lives, whatever the project's JWT expiry.
 * A re-enrolment's verify issues a new token, so the next real removal is recorded. Nothing here
 * reads enrolment rows. Keyed on those, a missed add hid the next removal (walk-oct-security-3
 * F1), and a hard-coded hour assumed Supabase's default expiry (walk-oct-security-4 F2, F3).
 * Unreadable token → false: never a row that might be misattributed.
 */
async function removedIsNew(adminUserId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || aal?.currentLevel !== "aal2") return false;
  const { data: sessionData } = await supabase.auth.getSession();
  const issuedAt = tokenIssuedAt(sessionData.session?.access_token);
  if (issuedAt === null) return false;
  const removedSince = await prisma.auditLog.findFirst({
    where: {
      entityId: adminUserId,
      action: { in: ["admin_mfa_self_removed", "admin_mfa_removed"] },
      createdAt: { gte: issuedAt },
    },
    select: { id: true },
  });
  return !removedSince;
}

/** The access token's `iat` as an instant. The token was already validated by getUser() in lib/auth.ts. */
function tokenIssuedAt(token: string | undefined): Date | null {
  try {
    const payload: unknown = JSON.parse(Buffer.from(token?.split(".")[1] ?? "", "base64url").toString("utf8"));
    const iat = (payload as { iat?: unknown }).iat;
    return typeof iat === "number" && Number.isFinite(iat) ? new Date(iat * 1000) : null;
  } catch {
    return null;
  }
}

export async function recordOwnMfaChangeAction(change: "added" | "removed"): Promise<{ error?: string }> {
  const { user, adminUser } = await getAuthenticatedAdmin({ skipMfaGate: true });

  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: user.id });
  if (error) return { error: error.message };
  const verifiedFactors = (data?.factors ?? []).filter((f) => f.status === "verified");
  const verified = verifiedFactors.length;

  const credible =
    change === "added"
      ? await addedIsNew(adminUser.id, verifiedFactors.map((f) => f.created_at))
      : verified === 0 && (await removedIsNew(adminUser.id));
  if (!credible) return {};

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
