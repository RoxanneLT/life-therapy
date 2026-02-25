"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { revalidatePath } from "next/cache";

// ────────────────────────────────────────────────────────────
// Profile (personal details)
// ────────────────────────────────────────────────────────────

export async function updateProfileAction(formData: FormData) {
  const { student } = await getAuthenticatedStudent();

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  if (!firstName || !lastName) return { error: "First and last name are required" };

  const phone = (formData.get("phone") as string)?.trim() || null;
  const gender = (formData.get("gender") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const relationshipStatus = (formData.get("relationshipStatus") as string)?.trim() || null;
  const emergencyContact = (formData.get("emergencyContact") as string)?.trim() || null;
  const referralSource = (formData.get("referralSource") as string)?.trim() || null;
  const referralDetail = (formData.get("referralDetail") as string)?.trim() || null;
  const dateOfBirthStr = (formData.get("dateOfBirth") as string)?.trim() || null;

  await prisma.student.update({
    where: { id: student.id },
    data: {
      firstName,
      lastName,
      phone,
      gender,
      address,
      relationshipStatus,
      emergencyContact,
      referralSource,
      referralDetail,
      dateOfBirth: dateOfBirthStr ? new Date(dateOfBirthStr) : null,
    },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Assessment (intake questionnaire)
// ────────────────────────────────────────────────────────────

export async function updateAssessmentAction(data: {
  behaviours: string[];
  feelings: string[];
  symptoms: string[];
  otherBehaviours?: string;
  otherFeelings?: string;
  otherSymptoms?: string;
  additionalNotes?: string;
}) {
  const { student } = await getAuthenticatedStudent();

  await prisma.clientIntake.upsert({
    where: { studentId: student.id },
    create: {
      studentId: student.id,
      behaviours: data.behaviours,
      feelings: data.feelings,
      symptoms: data.symptoms,
      otherBehaviours: data.otherBehaviours?.trim() || null,
      otherFeelings: data.otherFeelings?.trim() || null,
      otherSymptoms: data.otherSymptoms?.trim() || null,
      additionalNotes: data.additionalNotes?.trim() || null,
      lastEditedBy: "client",
      lastEditedAt: new Date(),
    },
    update: {
      behaviours: data.behaviours,
      feelings: data.feelings,
      symptoms: data.symptoms,
      otherBehaviours: data.otherBehaviours?.trim() || null,
      otherFeelings: data.otherFeelings?.trim() || null,
      otherSymptoms: data.otherSymptoms?.trim() || null,
      additionalNotes: data.additionalNotes?.trim() || null,
      lastEditedBy: "client",
      lastEditedAt: new Date(),
    },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Preferences (communication toggles)
// ────────────────────────────────────────────────────────────

const ALLOWED_FIELDS = [
  "newsletterOptIn",
  "marketingOptIn",
  "smsOptIn",
  "sessionReminders",
] as const;

export async function updatePreferenceAction(field: string, value: boolean) {
  if (!ALLOWED_FIELDS.includes(field as (typeof ALLOWED_FIELDS)[number])) {
    return { error: "Invalid preference field" };
  }

  const { student } = await getAuthenticatedStudent();

  await prisma.student.update({
    where: { id: student.id },
    data: { [field]: value },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Password
// ────────────────────────────────────────────────────────────

export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
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
      sendEmail({ to: student.email, subject, html, templateKey: "password_changed", studentId: student.id }),
    )
    .catch((err) => console.error("Failed to send password change email:", err));

  return { success: true };
}
