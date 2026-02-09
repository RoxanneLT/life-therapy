"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
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

  await prisma.digitalProduct.create({
    data: parsed,
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

  revalidatePath("/admin/digital-products");
  redirect("/admin/digital-products");
}

export async function deleteDigitalProduct(id: string) {
  await requireRole("super_admin");
  await prisma.digitalProduct.delete({ where: { id } });

  revalidatePath("/admin/digital-products");
  redirect("/admin/digital-products");
}
