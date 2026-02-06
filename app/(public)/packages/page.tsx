export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bundles & Packages",
  description:
    "Get more value with curated course bundles. Combine self-paced learning for the ultimate growth experience.",
};

export const revalidate = 60;

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
