import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/courses",
    "Online Courses",
    "Self-paced online courses covering self-esteem, confidence, anxiety, relationships, and more. Expert-designed by Roxanne Bouwer.",
    "/images/hero-courses.jpg"
  );
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; view?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category || "all";
  const viewMode = params.view || "grid";

  const page = await prisma.page.findUnique({
    where: { slug: "courses" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page || !page.isPublished) {
    notFound();
  }

  return (
    <SectionRenderer
      sections={page.sections}
      activeCategory={activeCategory}
      viewMode={viewMode}
    />
  );
}
