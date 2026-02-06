"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { lectureSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

function basePath(courseId: string, moduleId: string) {
  return `/admin/courses/${courseId}/modules/${moduleId}/lectures`;
}

export async function createLecture(
  courseId: string,
  moduleId: string,
  formData: FormData
) {
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const parsed = lectureSchema.parse({
    ...raw,
    isPreview: raw.isPreview === "true",
  });

  if (!raw.sortOrder) {
    const count = await prisma.lecture.count({ where: { moduleId } });
    parsed.sortOrder = count;
  }

  await prisma.lecture.create({
    data: { ...parsed, moduleId },
  });

  revalidatePath(basePath(courseId, moduleId));
  redirect(basePath(courseId, moduleId));
}

export async function updateLecture(
  courseId: string,
  moduleId: string,
  lectureId: string,
  formData: FormData
) {
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const parsed = lectureSchema.parse({
    ...raw,
    isPreview: raw.isPreview === "true",
  });

  await prisma.lecture.update({
    where: { id: lectureId },
    data: parsed,
  });

  revalidatePath(basePath(courseId, moduleId));
  redirect(basePath(courseId, moduleId));
}

export async function deleteLecture(
  courseId: string,
  moduleId: string,
  lectureId: string
) {
  await requireRole("super_admin", "editor");
  await prisma.lecture.delete({ where: { id: lectureId } });

  revalidatePath(basePath(courseId, moduleId));
}
