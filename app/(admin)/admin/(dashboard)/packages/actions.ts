"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { packageSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function createPackage(formData: FormData) {
  await requireRole("super_admin");
  const raw = Object.fromEntries(formData.entries());
  const courseIds = formData.getAll("courseIds") as string[];

  const parsed = packageSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
  });

  await prisma.hybridPackage.create({
    data: {
      ...parsed,
      documentUrl: parsed.documentUrl || null,
      courses: {
        create: courseIds.map((courseId, i) => ({
          courseId,
          sortOrder: i,
        })),
      },
    },
  });

  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}

export async function updatePackage(id: string, formData: FormData) {
  await requireRole("super_admin");
  const raw = Object.fromEntries(formData.entries());
  const courseIds = formData.getAll("courseIds") as string[];

  const parsed = packageSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
  });

  // Update package fields
  await prisma.hybridPackage.update({
    where: { id },
    data: {
      ...parsed,
      documentUrl: parsed.documentUrl || null,
    },
  });

  // Replace course associations: delete existing, create new
  await prisma.hybridPackageCourse.deleteMany({
    where: { hybridPackageId: id },
  });
  if (courseIds.length > 0) {
    await prisma.hybridPackageCourse.createMany({
      data: courseIds.map((courseId, i) => ({
        hybridPackageId: id,
        courseId,
        sortOrder: i,
      })),
    });
  }

  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}

export async function deletePackage(id: string) {
  await requireRole("super_admin");
  await prisma.hybridPackage.delete({ where: { id } });

  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}
