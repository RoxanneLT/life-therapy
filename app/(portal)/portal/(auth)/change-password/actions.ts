"use server";

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";

export async function changeStudentPassword(formData: FormData) {
  const { user, student } = await getAuthenticatedStudent();

  // Authorised by the ACCOUNT, not the session (dev-standards/ledgers/LESSONS.md L-72). This form
  // takes no current password, because it exists for one case: a login created with a temporary
  // password nobody was told, flagged mustChangePassword. Until 2026-09-10 it asked nothing more
  // than a signed-in session. So anyone holding a session (a copied cookie, a shared machine)
  // could set a password the owner does not know, and keep the account after the session ended.
  // Settings → Password is the path for everyone else, and it verifies the current password.
  if (!student.mustChangePassword) {
    return { error: "Your password is already set. To change it, use Settings, which asks for your current password." };
  }

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

  // Send confirmation email (non-blocking)
  renderEmail("password_changed", { firstName: student.firstName })
    .then(({ subject, html }) =>
      sendEmail({ to: student.email, subject, html, templateKey: "password_changed", studentId: student.id })
    )
    .catch((err) => console.error("Failed to send password change email:", err));

  return { success: true };
}
