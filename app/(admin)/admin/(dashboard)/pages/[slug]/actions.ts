"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { pageSectionSchema, pageSeoSchema } from "@/lib/validations";
import { requireRole } from "@/lib/auth";

/**
 * A page's search and social metadata, edited on its SEO tab. Lived in /admin/seo, a second screen
 * over the same eight rows, until 2026-10-10; every route there is one of these pages.
 */
export async function updatePageSeo(id: string, formData: FormData): Promise<{ error?: string }> {
  await requireRole("super_admin", "editor");

  const raw = Object.fromEntries(formData.entries());
  // Returned, not thrown: production strips a thrown message, and the reason is what they need.
  const result = pageSeoSchema.safeParse(raw);
  if (!result.success) return { error: result.error.issues[0]?.message ?? "Invalid SEO details" };
  const parsed = result.data;

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

  revalidateTag("page-seo", "max");
  revalidatePath("/admin/pages", "layout");
  return {};
}

export async function createSection(pageId: string, formData: FormData) {
  await requireRole("super_admin", "editor");
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
  await requireRole("super_admin", "editor");
  const raw = Object.fromEntries(formData.entries());
  const { sortOrder: _, ...parsed } = pageSectionSchema.parse({
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
  await requireRole("super_admin", "editor");
  await prisma.pageSection.delete({ where: { id: sectionId } });

  revalidatePath("/admin/pages");
  revalidatePath("/");
}

export async function reorderSections(
  pageId: string,
  sectionIds: string[]
) {
  await requireRole("super_admin", "editor");
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
  await requireRole("super_admin", "editor");
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
  await requireRole("super_admin", "editor");
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
