"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin, verifyPassword } from "@/lib/supabase-admin";
import { emailPasswordLink } from "@/lib/account-link";
import { isRateLimitedDb, recordHitDb, limitKey } from "@/lib/rate-limit-db";
import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";
import { recordAudit, recordAuthEvent } from "@/lib/audit";
import type { AdminRole } from "@/lib/generated/prisma/client";
import crypto from "crypto";
import { appBaseUrl } from "@/lib/region";
import { confirmWithTotp, recoveryLinkMfaHint } from "@/lib/mfa-step-up";
import { passwordLengthRefusal } from "@/lib/password-policy";
import { sendSecurityNotice } from "@/lib/security-notice";

const BASE_URL = appBaseUrl();

/**
 * Refusals are RETURNED; the success path still redirects.
 *
 * Supabase's own message is the valuable one here — "a user with this email
 * already exists" is the single most likely refusal, and the only one that tells
 * the admin what to do next. Thrown, it reached them as the digest boilerplate.
 */
export async function inviteUser(
  formData: FormData,
): Promise<{ success: false; error: string } | void> {
  const { adminUser: actor } = await requireRole("super_admin");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as AdminRole;

  if (!email || !role) {
    return { success: false, error: "An email address and a role are both required." };
  }

  // A new admin account is access granted: fresh 2FA, and a record of who granted it.
  const stepUp = await confirmWithTotp(formData.get("stepUpCode"));
  if (stepUp.error) return { success: false, error: stepUp.error };

  // Create user in Supabase Auth with a random temp password
  const tempPassword = crypto.randomBytes(16).toString("hex");
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError) {
    // Supabase's wording, unedited — it is more specific than anything I would
    // write here, and it is the reason the invite failed.
    return { success: false, error: authError.message };
  }

  // Create admin_users record
  const created = await prisma.adminUser.create({
    data: {
      supabaseUserId: authData.user.id,
      email,
      name: name || null,
      role,
    },
  });
  await recordAudit({
    action: "admin_user_invited",
    entityType: "admin_user",
    entityId: created.id,
    actorEmail: actor.email,
    after: { email, role },
  });

  // The invite IS a set-password link, emailed to the address. Until 2026-09-11 this called
  // generateLink and discarded the result, and the admin API sends nothing itself, so no invite
  // ever arrived: the new colleague had to find Forgot password on their own. Refused rather than
  // thrown: the account exists by now, and Forgot password still reaches it.
  const invite = await emailPasswordLink(
    email,
    (link) => ({ templateKey: "password_reset", variables: { resetUrl: link } }),
    BASE_URL,
  );
  if (!invite.ok || !invite.sent) {
    revalidatePath("/admin/settings/team");
    return {
      success: false,
      error: "The account was created, but the invite email did not send. Ask them to use Forgot password on the sign-in page.",
    };
  }

  revalidatePath("/admin/settings/team");
  redirect("/admin/settings/team");
}

export async function updateUser(
  id: string,
  formData: FormData,
): Promise<{ success: false; error: string } | void> {
  const { adminUser: currentAdmin } = await requireRole("super_admin");

  const name = formData.get("name") as string;
  const role = formData.get("role") as AdminRole;

  // Don't let a super admin demote themselves out of access — another super
  // admin must do it. RETURNED, not thrown: this is a rule the admin needs
  // explained, and it is the refusal they are most likely to hit here.
  if (currentAdmin.id === id && role !== "super_admin") {
    return {
      success: false,
      error: "You can't change your own role — ask another super admin to do it.",
    };
  }

  const existing = await prisma.adminUser.findUnique({ where: { id }, select: { email: true, name: true, role: true } });
  if (!existing) return { success: false, error: "That admin no longer exists." };

  // A role change grants or removes access, so it needs fresh 2FA. A name edit does not.
  const roleChanged = existing.role !== role;
  if (roleChanged) {
    const stepUp = await confirmWithTotp(formData.get("stepUpCode"));
    if (stepUp.error) return { success: false, error: stepUp.error };
  }

  await prisma.adminUser.update({
    where: { id },
    data: {
      name: name || null,
      role,
    },
  });
  if (roleChanged) {
    await recordAudit({
      action: "admin_role_changed",
      entityType: "admin_user",
      entityId: id,
      actorEmail: currentAdmin.email,
      before: { email: existing.email, role: existing.role },
      after: { email: existing.email, role },
    });
    await sendSecurityNotice(
      existing.email,
      existing.name,
      `Your Life-Therapy admin role was changed from ${roleLabel(existing.role)} to ${roleLabel(role)} by ${currentAdmin.email}.`,
    );
  }

  revalidatePath("/admin/settings/team");
  redirect("/admin/settings/team");
}

/** Refusals are RETURNED, and the caller (DeleteUserButton) shows them and navigates on success. */
export async function deleteUser(
  id: string,
  stepUpCode: string,
): Promise<{ success?: true; error?: string }> {
  const { adminUser: currentAdmin } = await requireRole("super_admin");

  if (currentAdmin.id === id) {
    return { error: "You can't delete your own account — ask another super admin." };
  }

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return { error: "That admin no longer exists." };

  const stepUp = await confirmWithTotp(stepUpCode);
  if (stepUp.error) return { error: stepUp.error };

  // Delete from Supabase Auth, and stop if that fails. Carrying on removed the admin_users row
  // over a live login: the audit row and the notice said the account was gone, and re-inviting
  // the address later failed with "user already exists". A 404 means it is already gone.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.supabaseUserId);
  if (authError && authError.status !== 404) {
    return { error: `Could not remove the sign-in for ${user.email}: ${authError.message}` };
  }

  // Delete from admin_users
  await prisma.adminUser.delete({ where: { id } });
  await recordAudit({
    action: "admin_user_deleted",
    entityType: "admin_user",
    entityId: id,
    actorEmail: currentAdmin.email,
    before: { email: user.email, role: user.role },
  });
  await sendSecurityNotice(user.email, user.name, `Your Life-Therapy admin account was removed by ${currentAdmin.email}. You can no longer sign in to the admin area.`);

  revalidatePath("/admin/settings/team");
  return { success: true };
}

/**
 * Refusals are RETURNED, not thrown.
 *
 * Next.js strips a thrown server-action message in production and replaces it
 * with "An error occurred in the Server Components render…". Every reason this
 * can refuse — too short, mismatched, or Supabase's own complaint (a password
 * found in a breach list, say) — reached the admin as that one sentence, on a
 * form where the actual reason is the only useful information. Catching it does
 * not help: `err.message` IS the boilerplate.
 */
export async function changePassword(
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const { user, adminUser } = await requireRole("super_admin", "editor", "marketing");

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  const tooShort = passwordLengthRefusal(newPassword);
  if (tooShort) {
    return { success: false, error: tooShort };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: "The two passwords do not match." };
  }

  // THE CURRENT PASSWORD IS THE AUTHORITY, as it is for a client in portal Settings. Until
  // 2026-09-11 a signed-in session was enough, justified by "the session is AAL2", but the 2FA gate
  // fails open when the assurance lookup errors (lib/auth.ts), and a session is not proof of the
  // account in any case (dev-standards/ledgers/LESSONS.md L-72). Throttled per account, so the form
  // is not a way to guess the current one.
  const guessKey = limitKey("pwchange", "user", user.id);
  if (await isRateLimitedDb(guessKey, 5)) {
    return { success: false, error: "Too many attempts. Please wait 15 minutes and try again." };
  }
  if (!currentPassword || !user.email || !(await verifyPassword(user.email, currentPassword))) {
    await recordHitDb(guessKey, 15 * 60 * 1000);
    return { success: false, error: "Your current password is incorrect." };
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (error) {
    // Supabase's message is the useful part here — it is the only place a
    // rejected password says WHY it was rejected.
    return { success: false, error: error.message };
  }
  await sendSecurityNotice(user.email, adminUser.name, "Your Life-Therapy admin password was changed.");

  revalidatePath("/admin/users");
  return { success: true };
}

/**
 * Remove all 2FA factors for an admin — the lockout-recovery path (a super_admin
 * helps a colleague who lost their authenticator). The colleague then signs in
 * with their password alone and can re-enrol.
 */
/**
 * deleteFactor RETURNS its error rather than throwing, so each result is read. Until 2026-10-10
 * a failed delete still recorded the removal, reported success, and told the target their 2FA was
 * gone while it was still live (walk-oct-security-5 F3).
 */
async function deleteEveryFactor(userId: string, factors: { id: string; status: string }[]) {
  const outcome = { removed: 0, verifiedRemoved: 0, verifiedSurvived: 0, failure: null as string | null };
  for (const factor of factors) {
    const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: factor.id, userId });
    const verified = factor.status === "verified";
    if (error) {
      outcome.failure ??= error.message;
      if (verified) outcome.verifiedSurvived++;
    } else {
      outcome.removed++;
      if (verified) outcome.verifiedRemoved++;
    }
  }
  return outcome;
}

export async function removeUserMfaAction(
  adminUserId: string,
  stepUpCode: string,
): Promise<{ success?: true; error?: string }> {
  const { adminUser: actor } = await requireRole("super_admin");

  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { supabaseUserId: true, email: true, name: true },
  });
  if (!target?.supabaseUserId) return { error: "User not found." };

  // Removing someone else's 2FA leaves their account on a password alone, so the person doing it
  // proves their own second factor first.
  const stepUp = await confirmWithTotp(stepUpCode);
  if (stepUp.error) return { error: stepUp.error };

  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({
    userId: target.supabaseUserId,
  });
  if (error) return { error: error.message };

  const all = data?.factors ?? [];
  if (all.length === 0) return { error: "This admin has no two-factor set up, so there is nothing to remove." };

  const outcome = await deleteEveryFactor(target.supabaseUserId, all);

  if (outcome.removed > 0) {
    await recordAudit({
      action: "admin_mfa_removed",
      entityType: "admin_user",
      entityId: adminUserId,
      actorEmail: actor.email,
      metadata: {
        targetEmail: target.email,
        factorsRemoved: outcome.removed,
        ...(outcome.failure ? { factorsFailed: all.length - outcome.removed } : {}),
      },
    });
  }
  // The target is told when their sign-in lost its second factor: a verified one went and no
  // verified one survived. An unverified survivor protects nothing, so it does not count.
  if (outcome.verifiedRemoved > 0 && outcome.verifiedSurvived === 0) {
    await sendSecurityNotice(
      target.email,
      target.name,
      `Two-factor sign-in was removed from your Life-Therapy admin account by ${actor.email}. Sign in and set it up again.`,
    );
  }
  if (outcome.failure) {
    revalidatePath(`/admin/users/${adminUserId}`);
    return { error: `Two-factor could not be fully removed: ${outcome.failure}` };
  }

  revalidatePath(`/admin/users/${adminUserId}`);
  return { success: true };
}

/**
 * Email another admin a password-reset link (super_admin-initiated). Mirrors the
 * public forgot-password flow: a recovery link that points straight at
 * /reset-password (the token is only consumed on submit, so link scanners can't
 * burn it). The admin sets their own new password — we never set it for them.
 */
export async function sendUserPasswordResetAction(
  adminUserId: string,
): Promise<{ success?: true; error?: string }> {
  const { adminUser: actor } = await requireRole("super_admin");

  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { email: true, supabaseUserId: true },
  });
  if (!target) return { error: "User not found." };

  try {
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: target.email,
      options: { redirectTo: `${BASE_URL}/auth/callback?next=/reset-password` },
    });
    if (linkError || !linkData?.properties?.hashed_token) {
      return { error: "Could not generate a reset link. Please try again." };
    }

    const actionLink = `${BASE_URL}/reset-password?token_hash=${encodeURIComponent(
      linkData.properties.hashed_token,
    )}&type=recovery${await recoveryLinkMfaHint(linkData.user?.id)}`;

    const { subject, html } = await renderEmail("password_reset", { resetUrl: actionLink });
    const result = await sendEmail({
      to: target.email,
      subject,
      html,
      templateKey: "password_reset",
      skipTracking: true,
    });
    if (!result.success) {
      return { error: "Failed to send the reset email. Please try again." };
    }

    await recordAuthEvent({
      action: "password_reset_requested",
      email: target.email,
      userId: target.supabaseUserId,
      reason: `admin-initiated by ${actor.email}`,
    });

    return { success: true };
  } catch (err) {
    console.error("[admin-password-reset] error:", err);
    return { error: "Something went wrong. Please try again." };
  }
}

function roleLabel(role: AdminRole): string {
  return role.replace(/_/g, " ");
}
