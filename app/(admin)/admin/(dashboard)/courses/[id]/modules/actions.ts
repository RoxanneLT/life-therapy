"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { moduleSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function createModule(courseId: string, formData: FormData) {
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const parsed = moduleSchema.parse(raw);

  // Auto-set sortOrder to end of list if not specified
  if (!raw.sortOrder) {
    const count = await prisma.module.count({ where: { courseId } });
    parsed.sortOrder = count;
  }

  await prisma.module.create({
    data: { ...parsed, courseId },
  });

  revalidatePath(`/admin/courses/${courseId}/modules`);
  redirect(`/admin/courses/${courseId}/modules`);
}

export async function updateModule(
  courseId: string,
  moduleId: string,
  formData: FormData
) {
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const parsed = moduleSchema.parse(raw);

  await prisma.module.update({
    where: { id: moduleId },
    data: parsed,
  });

  revalidatePath(`/admin/courses/${courseId}/modules`);
  redirect(`/admin/courses/${courseId}/modules`);
}

export async function deleteModule(courseId: string, moduleId: string) {
  await requireRole("super_admin", "editor");
  await prisma.module.delete({ where: { id: moduleId } });

  revalidatePath(`/admin/courses/${courseId}/modules`);
}

export async function reorderModules(
  courseId: string,
  orderedIds: string[]
) {
  await requireRole("super_admin", "editor");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.module.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath(`/admin/courses/${courseId}/modules`);
}
