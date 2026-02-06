export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Roxanne",
  description:
    "Meet Roxanne Bouwer — qualified life coach, counsellor, and NLP practitioner. Learn about the story behind Life-Therapy.",
};

export const revalidate = 60;

export default async function AboutPage() {
  const page = await prisma.page.findUnique({
    where: { slug: "about" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page || !page.isPublished) {
    notFound();
  }

  return <SectionRenderer sections={page.sections} />;
}
