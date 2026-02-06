"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AdminRole } from "@/lib/generated/prisma/client";
import crypto from "crypto";

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

  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUser(id: string, formData: FormData) {
  await requireRole("super_admin");

  const name = formData.get("name") as string;
  const role = formData.get("role") as AdminRole;

  await prisma.adminUser.update({
    where: { id },
    data: {
      name: name || null,
      role,
    },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
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

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
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
