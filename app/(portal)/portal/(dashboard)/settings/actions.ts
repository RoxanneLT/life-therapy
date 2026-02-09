"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";

export async function updateProfileAction(
  firstName: string,
  lastName: string
) {
  if (!firstName.trim() || !lastName.trim()) {
    return { error: "Name fields are required" };
  }

  const { student } = await getAuthenticatedStudent();

  await prisma.student.update({
    where: { id: student.id },
    data: { firstName: firstName.trim(), lastName: lastName.trim() },
  });

  return { success: true };
}

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string
) {
  if (newPassword.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const { student } = await getAuthenticatedStudent();
  const supabase = await createSupabaseServerClient();

  // Verify current password by signing in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: student.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Current password is incorrect" };
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: "Failed to update password. Please try again." };
  }

  // Send confirmation email (non-blocking)
  renderEmail("password_changed", { firstName: student.firstName })
    .then(({ subject, html }) =>
      sendEmail({ to: student.email, subject, html, templateKey: "password_changed", studentId: student.id })
    )
    .catch((err) => console.error("Failed to send password change email:", err));

  return { success: true };
}
