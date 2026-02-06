export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online Courses",
  description:
    "Self-paced online courses covering self-esteem, confidence, anxiety, relationships, and more. Expert-designed by Roxanne Bouwer.",
};

export const revalidate = 60;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category || "all";

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
    />
  );
}
