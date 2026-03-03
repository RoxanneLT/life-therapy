"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { digitalProductSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function createDigitalProduct(formData: FormData) {
  await requireRole("super_admin");
  const raw = Object.fromEntries(formData.entries());

  const parsed = digitalProductSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
  });

  // Auto-assign to end of list
  const maxOrder = await prisma.digitalProduct.aggregate({
    _max: { sortOrder: true },
  });

  await prisma.digitalProduct.create({
    data: {
      ...parsed,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/admin/digital-products");
  redirect("/admin/digital-products");
}

export async function updateDigitalProduct(id: string, formData: FormData) {
  await requireRole("super_admin");
  const raw = Object.fromEntries(formData.entries());

  const parsed = digitalProductSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
  });

  await prisma.digitalProduct.update({
    where: { id },
    data: parsed,
  });

  revalidateTag("page-seo", "max");
  revalidatePath("/admin/digital-products");
  redirect("/admin/digital-products");
}

export async function reorderDigitalProducts(orderedIds: string[]) {
  await requireRole("super_admin");

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.digitalProduct.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  revalidatePath("/admin/digital-products");
  revalidatePath("/products");
}

export async function renameCategory(oldName: string, newName: string) {
  await requireRole("super_admin");

  await prisma.digitalProduct.updateMany({
    where: { category: oldName },
    data: { category: newName || null },
  });

  revalidatePath("/admin/digital-products");
  revalidatePath("/products");
}

export async function deleteCategory(name: string) {
  await requireRole("super_admin");

  await prisma.digitalProduct.updateMany({
    where: { category: name },
    data: { category: null },
  });

  revalidatePath("/admin/digital-products");
  revalidatePath("/products");
}

export async function deleteDigitalProduct(id: string) {
  await requireRole("super_admin");
  await prisma.digitalProduct.delete({ where: { id } });

  revalidatePath("/admin/digital-products");
  redirect("/admin/digital-products");
}
