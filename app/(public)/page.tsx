export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";
import { professionalServiceJsonLd, JsonLdScript } from "@/lib/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/",
    "Life-Therapy | Personal Development & Life Coaching",
    "Transform your life with Roxanne Bouwer. Qualified life coach, counsellor & NLP practitioner offering online courses and 1:1 sessions.",
    "/images/hero-home.jpg"
  );
}

export const revalidate = 60;

export default async function HomePage() {
  const [page, profServiceLd] = await Promise.all([
    prisma.page.findUnique({
      where: { slug: "home" },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    }),
    professionalServiceJsonLd(),
  ]);

  if (!page || !page.isPublished) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-brand-600">
            Life-Therapy
          </h1>
          <p className="mt-2 text-muted-foreground">
            Coming soon. Content is being prepared.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <JsonLdScript data={profServiceLd} />
      <SectionRenderer sections={page.sections} />
    </>
  );
}
