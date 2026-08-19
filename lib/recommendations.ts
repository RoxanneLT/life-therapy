import { prisma } from "./prisma";
import { getCoursePrice } from "./pricing";
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
