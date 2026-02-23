export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";
import { professionalServiceJsonLd, JsonLdScript } from "@/lib/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/about",
    "About Roxanne Bouwer",
    "Meet Roxanne Bouwer — qualified life coach, counsellor, and NLP practitioner helping you build confidence and create meaningful change.",
    "/images/roxanne-portrait.jpg"
  );
}

export const revalidate = 60;

export default async function AboutPage() {
  const [page, profServiceLd] = await Promise.all([
    prisma.page.findUnique({
      where: { slug: "about" },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    }),
    professionalServiceJsonLd(),
  ]);

  if (!page || !page.isPublished) {
    notFound();
  }

  return (
    <>
      <JsonLdScript data={profServiceLd} />
      <SectionRenderer sections={page.sections} />
    </>
  );
}
