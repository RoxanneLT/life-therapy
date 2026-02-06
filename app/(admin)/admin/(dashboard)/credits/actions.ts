"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createCreditPackAction(formData: FormData) {
  await requireRole("super_admin");

  const name = (formData.get("name") as string).trim();
  const credits = parseInt(formData.get("credits") as string, 10);
  const priceCents = parseInt(formData.get("priceCents") as string, 10);

  if (!name || !credits || credits < 1) {
    throw new Error("Name and credits are required");
  }

  const maxSort = await prisma.sessionCreditPack.aggregate({
    _max: { sortOrder: true },
  });

  await prisma.sessionCreditPack.create({
    data: {
      name,
      credits,
      priceCents,
      sortOrder: (maxSort._max.sortOrder || 0) + 1,
    },
  });

  revalidatePath("/admin/credits");
  redirect("/admin/credits");
}

export async function updateCreditPackAction(formData: FormData) {
  await requireRole("super_admin");

  const id = formData.get("id") as string;
  const isPublished = formData.get("isPublished") === "true";

  await prisma.sessionCreditPack.update({
    where: { id },
    data: { isPublished },
  });

  revalidatePath("/admin/credits");
}

export async function deleteCreditPackAction(formData: FormData) {
  await requireRole("super_admin");

  const id = formData.get("id") as string;
  await prisma.sessionCreditPack.delete({ where: { id } });

  revalidatePath("/admin/credits");
  redirect("/admin/credits");
}
