import { prisma } from "./prisma";
import { getCoursePrice, getModulePrice } from "./pricing";
import type { Currency } from "./region";

interface RecommendedItem {
  id: string;
  type: "course" | "module";
  title: string;
  slug: string;
  imageUrl: string | null;
  price: number;
  category: string | null;
}

/**
 * Get related short courses for a given module.
 * Priority: same course modules first, then same category.
 */
export async function getRelatedShortCourses(
  moduleId: string,
  limit = 3,
  currency: Currency = "ZAR"
): Promise<RecommendedItem[]> {
  const currentModule = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { courseId: true, standaloneCategory: true },
  });
  if (!currentModule) return [];

  const moduleSelect = {
    id: true,
    standaloneTitle: true,
    title: true,
    standaloneSlug: true,
    standaloneImageUrl: true,
    standalonePrice: true,
    standalonePriceUsd: true,
    standalonePriceEur: true,
    standalonePriceGbp: true,
    standaloneCategory: true,
  };

  // Same course modules (different from current)
  const siblingModules = await prisma.module.findMany({
    where: {
      courseId: currentModule.courseId,
      isStandalonePublished: true,
      id: { not: moduleId },
      standaloneSlug: { not: null },
    },
    select: moduleSelect,
    orderBy: { sortOrder: "asc" },
    take: limit,
  });

  const results: RecommendedItem[] = siblingModules.map((m) => ({
    id: m.id,
    type: "module",
    title: m.standaloneTitle || m.title,
    slug: `short/${m.standaloneSlug}`,
    imageUrl: m.standaloneImageUrl,
    price: getModulePrice(m, currency),
    category: m.standaloneCategory,
  }));

  // If we need more, get same-category modules from other courses
  if (results.length < limit && currentModule.standaloneCategory) {
    const categoryModules = await prisma.module.findMany({
      where: {
        isStandalonePublished: true,
        standaloneCategory: currentModule.standaloneCategory,
        id: { notIn: [moduleId, ...results.map((r) => r.id)] },
        standaloneSlug: { not: null },
      },
      select: moduleSelect,
      take: limit - results.length,
    });

    results.push(
      ...categoryModules.map((m) => ({
        id: m.id,
        type: "module" as const,
        title: m.standaloneTitle || m.title,
        slug: `short/${m.standaloneSlug}`,
        imageUrl: m.standaloneImageUrl,
        price: getModulePrice(m, currency),
        category: m.standaloneCategory,
      }))
    );
  }

  return results;
}

/**
 * Get related courses for a given course.
 * Priority: admin overrides (relatedCourseIds) first, then same category.
 */
export async function getRelatedCourses(
  courseId: string,
  limit = 3,
  currency: Currency = "ZAR"
): Promise<RecommendedItem[]> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { category: true, relatedCourseIds: true },
  });
  if (!course) return [];

  const courseSelect = {
    id: true,
    title: true,
    slug: true,
    imageUrl: true,
    price: true,
    priceUsd: true,
    priceEur: true,
    priceGbp: true,
    category: true,
  };

  const results: RecommendedItem[] = [];

  // Admin overrides first
  const overrideIds = Array.isArray(course.relatedCourseIds)
    ? (course.relatedCourseIds as string[])
    : [];

  if (overrideIds.length > 0) {
    const overrideCourses = await prisma.course.findMany({
      where: {
        id: { in: overrideIds },
        isPublished: true,
      },
      select: courseSelect,
      take: limit,
    });

    results.push(
      ...overrideCourses.map((c) => ({
        id: c.id,
        type: "course" as const,
        title: c.title,
        slug: c.slug,
        imageUrl: c.imageUrl,
        price: getCoursePrice(c, currency),
        category: c.category,
      }))
    );
  }

  // Fill with same-category courses
  if (results.length < limit && course.category) {
    const categoryCourses = await prisma.course.findMany({
      where: {
        isPublished: true,
        category: course.category,
        id: { notIn: [courseId, ...results.map((r) => r.id)] },
      },
      select: courseSelect,
      take: limit - results.length,
    });

    results.push(
      ...categoryCourses.map((c) => ({
        id: c.id,
        type: "course" as const,
        title: c.title,
        slug: c.slug,
        imageUrl: c.imageUrl,
        price: getCoursePrice(c, currency),
        category: c.category,
      }))
    );
  }

  return results;
}
