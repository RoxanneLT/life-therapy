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
  });

  await prisma.course.update({ where: { id }, data: parsed });

  revalidateTag("page-seo", "max");
  revalidatePath("/admin/courses");
  revalidatePath("/");
  redirect("/admin/courses");
}

/**
 * Delete a course — REFUSED once any student record hangs off it.
 *
 * The FKs from enrollments, certificates and module_access used to be ON DELETE
 * CASCADE, so this one line silently erased every paying student's enrolment, their
 * earned certificate and their progress, irrecoverably, at the hands of anyone with
 * the `editor` role. That contradicts the project's own soft-delete rule, and the
 * live data made it concrete: "Confidence from Within" is UNPUBLISHED yet carries a
 * real enrolment and a real certificate — precisely the course someone deletes
 * believing it is a draft.
 *
 * Those four FKs are now ON DELETE RESTRICT, so the database refuses too. This check
 * exists so the admin gets a sentence instead of a constraint violation; the FK is
 * the guarantee, this is the manners.
 */
export async function deleteCourse(id: string): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin", "editor");

  const [enrollments, certificates, moduleAccess] = await Promise.all([
    prisma.enrollment.count({ where: { courseId: id } }),
    prisma.certificate.count({ where: { courseId: id } }),
    prisma.moduleAccess.count({ where: { courseId: id } }),
  ]);

  const blockers = [
    enrollments && `${enrollments} enrolment${enrollments === 1 ? "" : "s"}`,
    certificates && `${certificates} certificate${certificates === 1 ? "" : "s"}`,
    moduleAccess && `${moduleAccess} module purchase${moduleAccess === 1 ? "" : "s"}`,
  ].filter(Boolean);

  if (blockers.length > 0) {
    return {
      success: false,
      error: `This course can't be deleted — it has ${blockers.join(", ")} attached to real students. Unpublish it instead so it disappears from the site while their records stay intact.`,
    };
  }

  try {
    await prisma.course.delete({ where: { id } });
  } catch (err) {
    // P2003 = the RESTRICT fired on something the counts above don't cover.
    if ((err as { code?: string })?.code === "P2003") {
      return {
        success: false,
        error: "This course still has student records attached and can't be deleted. Unpublish it instead.",
      };
    }
    throw err;
  }

  revalidatePath("/admin/courses");
  revalidatePath("/");
  return { success: true };
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
