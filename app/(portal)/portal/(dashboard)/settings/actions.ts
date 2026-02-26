"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getBaseUrl } from "@/lib/get-region";
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

// ────────────────────────────────────────────────────────────
// Relationships — Partner invite
// ────────────────────────────────────────────────────────────

export async function sendPartnerInviteAction(data: {
  name: string;
  email: string;
}) {
  const { student } = await getAuthenticatedStudent();
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();

  if (!name || name.length < 2) return { error: "Please enter a valid name." };
  if (!email || !email.includes("@")) return { error: "Please enter a valid email." };
  if (email === student.email.toLowerCase()) return { error: "You cannot invite yourself." };

  // Check for existing partner relationship
  const existingPartner = await prisma.clientRelationship.findFirst({
    where: {
      relationshipType: "partner",
      OR: [
        { studentId: student.id, relatedStudentId: { not: null } },
        { relatedStudentId: student.id },
      ],
    },
  });
  if (existingPartner) return { error: "You already have a linked partner." };

  // Check for pending invite to this email
  const existingInvite = await prisma.relationshipInvite.findFirst({
    where: {
      fromStudentId: student.id,
      toEmail: email,
      status: "pending",
    },
  });
  if (existingInvite) return { error: "You already have a pending invite to this email." };

  // Lookup existing student by email
  const existingStudent = await prisma.student.findUnique({
    where: { email },
    select: { id: true, firstName: true },
  });

  const invite = await prisma.relationshipInvite.create({
    data: {
      fromStudentId: student.id,
      toEmail: email,
      toName: name,
      relationshipType: "partner",
      toStudentId: existingStudent?.id ?? null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Send appropriate email
  const baseUrl = await getBaseUrl();
  const fromName = `${student.firstName} ${student.lastName || ""}`.trim();

  if (existingStudent) {
    const rendered = await renderEmail("relationship_invite", {
      fromName,
      toName: existingStudent.firstName,
      relationshipLabel: "partner",
      portalUrl: `${baseUrl}/portal/settings?tab=relationships`,
    }, baseUrl);
    sendEmail({ to: email, ...rendered, templateKey: "relationship_invite", metadata: { inviteId: invite.id } })
      .catch((err) => console.error("Failed to send relationship invite:", err));
  } else {
    const rendered = await renderEmail("relationship_invite_signup", {
      fromName,
      toName: name,
      relationshipLabel: "partner",
      signupUrl: `${baseUrl}/portal/login`,
    }, baseUrl);
    sendEmail({ to: email, ...rendered, templateKey: "relationship_invite_signup", metadata: { inviteId: invite.id } })
      .catch((err) => console.error("Failed to send relationship signup invite:", err));
  }

  revalidatePath("/portal/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Relationships — Respond to invite
// ────────────────────────────────────────────────────────────

export async function respondToInviteAction(inviteId: string, accept: boolean) {
  const { student } = await getAuthenticatedStudent();

  const invite = await prisma.relationshipInvite.findFirst({
    where: {
      id: inviteId,
      status: "pending",
      OR: [
        { toStudentId: student.id },
        { toEmail: student.email.toLowerCase() },
      ],
    },
    include: { fromStudent: { select: { id: true, firstName: true, lastName: true } } },
  });

  if (!invite) return { error: "Invite not found or already handled." };
  if (invite.expiresAt < new Date()) {
    await prisma.relationshipInvite.update({ where: { id: inviteId }, data: { status: "expired" } });
    return { error: "This invite has expired." };
  }

  if (!accept) {
    await prisma.relationshipInvite.update({ where: { id: inviteId }, data: { status: "declined" } });
    revalidatePath("/portal/settings");
    return { success: true };
  }

  // Accept — create bidirectional relationships
  await prisma.$transaction([
    prisma.clientRelationship.create({
      data: {
        studentId: invite.fromStudentId,
        relatedStudentId: student.id,
        relationshipType: "partner",
        relationshipLabel: "Partner",
      },
    }),
    prisma.clientRelationship.create({
      data: {
        studentId: student.id,
        relatedStudentId: invite.fromStudentId,
        relationshipType: "partner",
        relationshipLabel: "Partner",
      },
    }),
    prisma.relationshipInvite.update({
      where: { id: inviteId },
      data: { status: "accepted", toStudentId: student.id },
    }),
  ]);

  revalidatePath("/portal/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Relationships — Cancel outgoing invite
// ────────────────────────────────────────────────────────────

export async function cancelInviteAction(inviteId: string) {
  const { student } = await getAuthenticatedStudent();

  const invite = await prisma.relationshipInvite.findFirst({
    where: { id: inviteId, fromStudentId: student.id, status: "pending" },
  });
  if (!invite) return { error: "Invite not found." };

  await prisma.relationshipInvite.update({
    where: { id: inviteId },
    data: { status: "cancelled" },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Relationships — Add minor (child)
// ────────────────────────────────────────────────────────────

export async function addMinorAction(data: {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: string;
}) {
  const { student } = await getAuthenticatedStudent();
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();

  if (!firstName || !lastName) return { error: "First and last name are required." };
  if (!data.dateOfBirth) return { error: "Date of birth is required." };

  // Create minor Student record with placeholder email
  const placeholderEmail = `minor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@noemail.internal`;

  const minor = await prisma.student.create({
    data: {
      email: placeholderEmail,
      firstName,
      lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender?.trim() || null,
      clientStatus: "potential",
      onboardingStep: 0,
      source: "portal",
    },
  });

  // Create bidirectional relationships
  const parentRel = await prisma.clientRelationship.create({
    data: {
      studentId: student.id,
      relatedStudentId: minor.id,
      relationshipType: "parent",
      relationshipLabel: "Parent",
    },
  });

  await prisma.clientRelationship.create({
    data: {
      studentId: minor.id,
      relatedStudentId: student.id,
      relationshipType: "child",
      relationshipLabel: "Child",
    },
  });

  // Set parent as billing contact for the child's individual sessions
  await prisma.student.update({
    where: { id: minor.id },
    data: { individualBilledToId: parentRel.id },
  });

  revalidatePath("/portal/settings");
  return { success: true, minorId: minor.id };
}

// ────────────────────────────────────────────────────────────
// Relationships — Update minor details
// ────────────────────────────────────────────────────────────

export async function updateMinorAction(
  minorStudentId: string,
  data: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender?: string;
  },
) {
  const { student } = await getAuthenticatedStudent();
  const firstName = data.firstName.trim();
  const lastName = data.lastName.trim();

  if (!firstName || !lastName) return { error: "First and last name are required." };
  if (!data.dateOfBirth) return { error: "Date of birth is required." };

  // Verify the caller is a parent of this minor
  const parentRel = await prisma.clientRelationship.findFirst({
    where: {
      studentId: student.id,
      relatedStudentId: minorStudentId,
      relationshipType: "parent",
    },
  });
  if (!parentRel) return { error: "You can only edit minors under your profile." };

  // Verify the minor has no login (is actually a minor record)
  const minor = await prisma.student.findUnique({
    where: { id: minorStudentId },
    select: { supabaseUserId: true },
  });
  if (!minor) return { error: "Minor not found." };
  if (minor.supabaseUserId) return { error: "This person has their own account and cannot be edited." };

  await prisma.student.update({
    where: { id: minorStudentId },
    data: {
      firstName,
      lastName,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender?.trim() || null,
    },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Relationships — Remove relationship
// ────────────────────────────────────────────────────────────

export async function removeRelationshipAction(relationshipId: string) {
  const { student } = await getAuthenticatedStudent();

  // Only allow removing relationships the client owns
  const rel = await prisma.clientRelationship.findFirst({
    where: { id: relationshipId, studentId: student.id },
    include: { relatedStudent: { select: { id: true, supabaseUserId: true } } },
  });
  if (!rel) return { error: "Relationship not found." };

  // Remove the reverse relationship too
  if (rel.relatedStudentId) {
    await prisma.clientRelationship.deleteMany({
      where: {
        studentId: rel.relatedStudentId,
        relatedStudentId: student.id,
      },
    });
  }

  // Delete the relationship
  await prisma.clientRelationship.delete({
    where: { id: relationshipId },
  });

  revalidatePath("/portal/settings");
  return { success: true };
}
