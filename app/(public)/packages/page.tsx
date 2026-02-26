import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/packages",
    "Bundles & Packages",
    "Get more value with curated course bundles. Combine self-paced learning for the ultimate personal growth experience.",
    "/images/hero-packages.jpg"
  );
}

export default async function PackagesPage() {
  const page = await prisma.page.findUnique({
    where: { slug: "packages" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page || !page.isPublished) {
    notFound();
  }

  return <SectionRenderer sections={page.sections} />;
}
