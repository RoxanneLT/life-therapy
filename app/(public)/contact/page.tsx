export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/contact",
    "Contact",
    "Get in touch with Life-Therapy. Reach out via email, WhatsApp, or book a free consultation.",
    "/images/hero-contact.jpg"
  );
}

export const revalidate = 60;

export default async function ContactPage() {
  const page = await prisma.page.findUnique({
    where: { slug: "contact" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page || !page.isPublished) {
    notFound();
  }

  return <SectionRenderer sections={page.sections} />;
}
