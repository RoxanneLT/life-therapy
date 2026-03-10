"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { courseSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function createCourse(formData: FormData) {
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const parsed = courseSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
    isFeatured: raw.isFeatured === "true",
    isShortCourse: raw.isShortCourse === "true",
  });

  // Always add new courses at the end of the list
  const count = await prisma.course.count();
  parsed.sortOrder = count;

  await prisma.course.create({ data: parsed });

  revalidatePath("/admin/courses");
  revalidatePath("/");
  redirect("/admin/courses");
}

export async function updateCourse(id: string, formData: FormData) {
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const parsed = courseSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
    isFeatured: raw.isFeatured === "true",
    isShortCourse: raw.isShortCourse === "true",
  });

  await prisma.course.update({ where: { id }, data: parsed });

  revalidateTag("page-seo", "max");
  revalidatePath("/admin/courses");
  revalidatePath("/");
  redirect("/admin/courses");
}

export async function deleteCourse(id: string) {
  await requireRole("super_admin", "editor");
  await prisma.course.delete({ where: { id } });

  revalidatePath("/admin/courses");
  revalidatePath("/");
}

export async function reorderCourses(orderedIds: string[]) {
  await requireRole("super_admin", "editor");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.course.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidatePath("/admin/courses");
  revalidatePath("/");
}
