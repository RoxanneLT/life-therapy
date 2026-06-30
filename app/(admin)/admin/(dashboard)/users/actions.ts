"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";
import { recordAuthEvent } from "@/lib/audit";
import type { AdminRole } from "@/lib/generated/prisma/client";
import crypto from "crypto";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.co.za";

export async function inviteUser(formData: FormData) {
  await requireRole("super_admin");

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const role = formData.get("role") as AdminRole;

  if (!email || !role) {
    throw new Error("Email and role are required");
  }

  // Create user in Supabase Auth with a random temp password
  const tempPassword = crypto.randomBytes(16).toString("hex");
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError) {
    throw new Error(authError.message);
  }

  // Create admin_users record
  await prisma.adminUser.create({
    data: {
      supabaseUserId: authData.user.id,
      email,
      name: name || null,
      role,
    },
  });

  // Send password reset email so user can set their own password
  await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  revalidatePath("/admin/settings/team");
  redirect("/admin/settings/team");
}

export async function updateUser(id: string, formData: FormData) {
  const { adminUser: currentAdmin } = await requireRole("super_admin");

  const name = formData.get("name") as string;
  const role = formData.get("role") as AdminRole;

  // Don't let a super admin demote themselves out of access — another super
  // admin must do it.
  if (currentAdmin.id === id && role !== "super_admin") {
    throw new Error("You can't change your own role. Ask another super admin to do it.");
  }

  await prisma.adminUser.update({
    where: { id },
    data: {
      name: name || null,
      role,
    },
  });

  revalidatePath("/admin/settings/team");
  redirect("/admin/settings/team");
}

export async function deleteUser(id: string) {
  const { adminUser: currentAdmin } = await requireRole("super_admin");

  // Prevent deleting yourself
  if (currentAdmin.id === id) {
    throw new Error("You cannot delete your own account");
  }

  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return;

  // Delete from Supabase Auth
  await supabaseAdmin.auth.admin.deleteUser(user.supabaseUserId);

  // Delete from admin_users
  await prisma.adminUser.delete({ where: { id } });

  revalidatePath("/admin/users");
}

export async function changePassword(formData: FormData) {
  const { user } = await requireRole("super_admin", "editor", "marketing");

  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}

/**
 * Remove all 2FA factors for an admin — the lockout-recovery path (a super_admin
 * helps a colleague who lost their authenticator). The colleague then signs in
 * with their password alone and can re-enrol.
 */
export async function removeUserMfaAction(
  adminUserId: string,
): Promise<{ success?: true; error?: string }> {
  await requireRole("super_admin");

  const target = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { supabaseUserId: true },
  });
  if (!target?.supabaseUserId) return { error: "User not found." };

  const { data, error } = await supabaseAdmin.auth.admin.mfa.listFactors({
    userId: target.supabaseUserId,
  });
  if (error) return { error: error.message };

  for (const factor of data?.factors ?? []) {
    await supabaseAdmin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: target.supabaseUserId,
    });
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
    )}&type=recovery`;

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
