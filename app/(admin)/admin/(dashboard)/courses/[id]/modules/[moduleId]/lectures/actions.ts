"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { lectureSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { deleteFromStorage, deleteStreamVideo, extractStreamGuid } from "@/lib/bunny";
import { recalculateCourseStats } from "@/lib/course-stats";

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

  await recalculateCourseStats(courseId);
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

  await recalculateCourseStats(courseId);
  revalidatePath(basePath(courseId, moduleId));
  redirect(basePath(courseId, moduleId));
}

export async function deleteLecture(
  courseId: string,
  moduleId: string,
  lectureId: string
) {
  await requireRole("super_admin", "editor");

  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: { videoUrl: true, worksheetUrl: true },
  });

  await prisma.lecture.delete({ where: { id: lectureId } });

  // Clean up Bunny resources (best-effort, don't block on failure)
  if (lecture?.videoUrl) {
    const guid = extractStreamGuid(lecture.videoUrl);
    if (guid) deleteStreamVideo(guid).catch(console.error);
  }
  if (lecture?.worksheetUrl) {
    deleteFromStorage(lecture.worksheetUrl).catch(console.error);
  }

  await recalculateCourseStats(courseId);
  revalidatePath(basePath(courseId, moduleId));
}
