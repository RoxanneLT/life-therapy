"use server";

import { requireRole } from "@/lib/auth";
import { addCredits } from "@/lib/credits";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function grantCreditsAction(formData: FormData) {
  await requireRole("super_admin");

  const studentId = formData.get("studentId") as string;
  const amount = parseInt(formData.get("amount") as string, 10);
  const description = (formData.get("description") as string) || "Admin grant";

  if (!studentId || !amount || amount < 1) {
    throw new Error("Invalid grant data");
  }

  await addCredits(studentId, amount, description);

  revalidatePath(`/admin/students/${studentId}`);
  redirect(`/admin/students/${studentId}`);
}

export async function grantModuleAccessAction(formData: FormData) {
  await requireRole("super_admin");

  const studentId = formData.get("studentId") as string;
  const moduleId = formData.get("moduleId") as string;

  if (!studentId || !moduleId) {
    throw new Error("Student ID and Module ID are required");
  }

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true },
  });
  if (!mod) {
    throw new Error("Module not found");
  }

  await prisma.moduleAccess.upsert({
    where: {
      studentId_moduleId: { studentId, moduleId },
    },
    create: {
      studentId,
      moduleId,
      courseId: mod.courseId,
      pricePaid: 0,
      source: "admin_grant",
    },
    update: {},
  });

  revalidatePath(`/admin/students/${studentId}`);
  redirect(`/admin/students/${studentId}`);
}
