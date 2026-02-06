"use server";

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedStudent } from "@/lib/student-auth";

export async function changeStudentPassword(formData: FormData) {
  const { user, student } = await getAuthenticatedStudent();

  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  // Clear the mustChangePassword flag
  await prisma.student.update({
    where: { id: student.id },
    data: { mustChangePassword: false },
  });

  return { success: true };
}
