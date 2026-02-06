"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { pageSectionSchema } from "@/lib/validations";

export async function createSection(pageId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = pageSectionSchema.parse({
    ...raw,
    isVisible: raw.isVisible === "true",
    config: raw.config ? JSON.parse(raw.config as string) : undefined,
  });

  const maxOrder = await prisma.pageSection.findFirst({
    where: { pageId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.pageSection.create({
    data: {
      pageId,
      ...parsed,
      sortOrder: (maxOrder?.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function updateSection(sectionId: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = pageSectionSchema.parse({
    ...raw,
    isVisible: raw.isVisible === "true",
    config: raw.config ? JSON.parse(raw.config as string) : undefined,
  });

  await prisma.pageSection.update({
    where: { id: sectionId },
    data: parsed,
  });

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function deleteSection(sectionId: string) {
  await prisma.pageSection.delete({ where: { id: sectionId } });

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function reorderSections(
  pageId: string,
  sectionIds: string[]
) {
  await Promise.all(
    sectionIds.map((id, index) =>
      prisma.pageSection.update({
        where: { id },
        data: { sortOrder: index },
      })
    )
  );

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function togglePagePublished(pageId: string) {
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) return;

  await prisma.page.update({
    where: { id: pageId },
    data: { isPublished: !page.isPublished },
  });

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function toggleSectionVisibility(sectionId: string) {
  const section = await prisma.pageSection.findUnique({
    where: { id: sectionId },
  });
  if (!section) return;

  await prisma.pageSection.update({
    where: { id: sectionId },
    data: { isVisible: !section.isVisible },
  });

  revalidatePath("/admin/pages");
  revalidatePath("/");
}
