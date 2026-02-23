"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { packageSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function createPackage(formData: FormData) {
  await requireRole("super_admin");
  const raw = Object.fromEntries(formData.entries());

  const parsed = packageSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
  });

  await prisma.hybridPackage.create({
    data: parsed,
  });

  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}

export async function updatePackage(id: string, formData: FormData) {
  await requireRole("super_admin");
  const raw = Object.fromEntries(formData.entries());

  const parsed = packageSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
  });

  await prisma.hybridPackage.update({
    where: { id },
    data: parsed,
  });

  revalidateTag("page-seo");
  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}

export async function deletePackage(id: string) {
  await requireRole("super_admin");
  await prisma.hybridPackage.delete({ where: { id } });

  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}
