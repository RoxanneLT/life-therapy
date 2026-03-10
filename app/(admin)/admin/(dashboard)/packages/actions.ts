"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { packageSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

function parsePackageFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  return packageSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
    isFixed: raw.isFixed === "true",
    fixedCourseIds: formData.getAll("fixedCourseIds").map(String),
    fixedModuleIds: formData.getAll("fixedModuleIds").map(String),
    fixedDigitalProductIds: formData.getAll("fixedDigitalProductIds").map(String),
  });
}

export async function createPackage(formData: FormData) {
  await requireRole("super_admin");

  const parsed = parsePackageFormData(formData);

  const maxOrder = await prisma.hybridPackage.aggregate({
    _max: { sortOrder: true },
  });

  await prisma.hybridPackage.create({
    data: {
      ...parsed,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}

export async function updatePackage(id: string, formData: FormData) {
  await requireRole("super_admin");

  const parsed = parsePackageFormData(formData);

  await prisma.hybridPackage.update({
    where: { id },
    data: parsed,
  });

  revalidateTag("page-seo", "max");
  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}

export async function reorderPackages(orderedIds: string[]) {
  await requireRole("super_admin");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.hybridPackage.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidatePath("/admin/packages");
  revalidatePath("/packages");
}

export async function renamePackageCategory(oldName: string, newName: string) {
  await requireRole("super_admin");

  await prisma.hybridPackage.updateMany({
    where: { category: oldName },
    data: { category: newName || null },
  });

  revalidatePath("/admin/packages");
  revalidatePath("/packages");
}

export async function deletePackageCategory(name: string) {
  await requireRole("super_admin");

  await prisma.hybridPackage.updateMany({
    where: { category: name },
    data: { category: null },
  });

  revalidatePath("/admin/packages");
  revalidatePath("/packages");
}

export async function deletePackage(id: string) {
  await requireRole("super_admin");
  await prisma.hybridPackage.delete({ where: { id } });

  revalidatePath("/admin/packages");
}
