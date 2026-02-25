"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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

  revalidatePath("/portal/preferences");
  return { success: true };
}
