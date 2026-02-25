"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { acceptDocument, ONBOARDING_DOCUMENTS } from "@/lib/legal-documents";

export async function savePersonalDetailsAction(formData: FormData) {
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
      onboardingStep: Math.max(student.onboardingStep, 1),
    },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/onboarding");
  return { success: true };
}

export async function saveAssessmentAction(data: {
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

  await prisma.student.update({
    where: { id: student.id },
    data: { onboardingStep: Math.max(student.onboardingStep, 2) },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/onboarding");
  return { success: true };
}

export async function acceptOnboardingDocumentsAction() {
  const { student } = await getAuthenticatedStudent();
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim()
    || headersList.get("x-real-ip") || "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  // Accept all onboarding documents (commitment + terms)
  for (const slug of ONBOARDING_DOCUMENTS) {
    await acceptDocument(student.id, slug, ip, userAgent);
  }

  // Update student status
  const updateData: Record<string, unknown> = {
    onboardingStep: 3,
    profileCompletedAt: new Date(),
  };
  if (student.clientStatus === "potential") {
    updateData.clientStatus = "active";
    if (!student.convertedAt) {
      updateData.convertedAt = new Date();
      updateData.convertedBy = "self";
    }
  }

  await prisma.student.update({
    where: { id: student.id },
    data: updateData,
  });

  revalidatePath("/portal");
  redirect("/portal");
}
