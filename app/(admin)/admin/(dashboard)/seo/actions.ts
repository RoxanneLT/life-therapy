"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { revalidateTag } from "next/cache";
import { pageSeoSchema } from "@/lib/validations";
import { requireRole } from "@/lib/auth";

export async function updatePageSeo(id: string, formData: FormData) {
  await requireRole("super_admin", "editor");

  const raw = Object.fromEntries(formData.entries());
  const parsed = pageSeoSchema.parse(raw);

  // Transform empty strings to null for DB storage
  await prisma.pageSeo.update({
    where: { id },
    data: {
      metaTitle: parsed.metaTitle || null,
      metaDescription: parsed.metaDescription || null,
      ogImageUrl: parsed.ogImageUrl || null,
      keywords: parsed.keywords || null,
    },
  });

  revalidateTag("page-seo");
  revalidatePath("/admin/seo");
}
