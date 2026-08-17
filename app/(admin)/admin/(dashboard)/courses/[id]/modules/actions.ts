"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { moduleSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { recalculateCourseStats } from "@/lib/course-stats";

export async function createModule(courseId: string, formData: FormData) {
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const parsed = moduleSchema.parse({
    ...raw,
    isStandalonePublished: raw.isStandalonePublished === "true",
  });

  // Always add new modules at the end of the list
  const count = await prisma.module.count({ where: { courseId } });
  parsed.sortOrder = count;

  await prisma.module.create({
    data: { ...parsed, courseId },
  });

  await recalculateCourseStats(courseId);
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
  const parsed = moduleSchema.parse({
    ...raw,
    isStandalonePublished: raw.isStandalonePublished === "true",
  });

  await prisma.module.update({
    where: { id: moduleId },
    data: parsed,
  });

  revalidatePath(`/admin/courses/${courseId}/modules`);
  redirect(`/admin/courses/${courseId}/modules`);
}

/** Delete a module — REFUSED once someone has bought access to it.
 *  module_access.moduleId is ON DELETE RESTRICT as of 2026-08-17; this check turns
 *  the constraint violation into a sentence. See deleteCourse for the full note. */
export async function deleteModule(
  courseId: string,
  moduleId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin", "editor");

  const purchases = await prisma.moduleAccess.count({ where: { moduleId } });
  if (purchases > 0) {
    return {
      success: false,
      error: `This module can't be deleted — ${purchases} student${purchases === 1 ? " has" : "s have"} bought access to it. Unpublish the course instead.`,
    };
  }

  try {
    await prisma.module.delete({ where: { id: moduleId } });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2003") {
      return {
        success: false,
        error: "This module still has student records attached and can't be deleted.",
      };
    }
    throw err;
  }

  await recalculateCourseStats(courseId);
  revalidatePath(`/admin/courses/${courseId}/modules`);
  return { success: true };
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
