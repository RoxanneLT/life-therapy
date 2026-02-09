import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";

/**
 * Find an existing student by email or auto-create one.
 * Used for gift recipients who may not have an account yet.
 * Auto-created students get mustChangePassword = true.
 */
export async function findOrCreateStudent(
  email: string,
  firstName: string,
  lastName: string
): Promise<{ id: string; isNew: boolean; tempPassword?: string }> {
  // Check if student exists
  const existing = await prisma.student.findUnique({ where: { email } });
  if (existing) {
    return { id: existing.id, isNew: false };
  }

  // Generate a temporary password
  const tempPassword =
    "LT-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  // Create Supabase auth user
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    throw new Error(
      `Failed to create auth user: ${authError?.message || "Unknown error"}`
    );
  }

  // Create student record
  const student = await prisma.student.create({
    data: {
      supabaseUserId: authData.user.id,
      email,
      firstName,
      lastName,
      mustChangePassword: true,
    },
  });

  // Send provisioned account email (non-blocking)
  renderEmail("account_provisioned", {
    firstName,
    tempPassword,
    loginUrl: "https://life-therapy.co.za/portal/login",
  }).then(({ subject, html }) =>
    sendEmail({ to: email, subject, html })
  ).catch((err) =>
    console.error("Failed to send provisioned account email:", err)
  );

  return { id: student.id, isNew: true, tempPassword };
}
