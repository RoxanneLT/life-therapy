import { prisma } from "@/lib/prisma";
import { SectionRenderer } from "@/components/public/section-renderer";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PageSection } from "@/lib/generated/prisma/client";
import { getCurrency } from "@/lib/get-region";
import { getSiteSettings } from "@/lib/settings";
import { getSessionPrice } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { buildStaticPageMetadata } from "@/lib/metadata";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/sessions",
    "1:1 Online Sessions",
    "Personalised online life coaching and counselling sessions with Roxanne Bouwer. Secure video calls from anywhere in the world.",
    "/images/hero-sessions.jpg"
  );
}

export default async function SessionsPage() {
  const page = await prisma.page.findUnique({
    where: { slug: "sessions" },
    include: { sections: { orderBy: { sortOrder: "asc" } } },
  });

  if (!page || !page.isPublished) {
    notFound();
  }

  const currency = await getCurrency();
  const settings = await getSiteSettings();

  // Inject dynamic session prices into any pricing sections
  const sections = page.sections.map((section) => {
    if (section.sectionType !== "pricing") return section;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = (section.config as any) || {};
    const items = (config.items || []).map((item: { title?: string; price?: string }) => {
      const title = (item.title || "").toLowerCase();

      if (title.includes("free") || title.includes("consultation")) {
        return { ...item, price: "Free" };
      }
      if (title.includes("couples")) {
        const cents = getSessionPrice("couples", currency, settings);
        return { ...item, price: formatPrice(cents, currency) };
      }
      if (title.includes("individual")) {
        const cents = getSessionPrice("individual", currency, settings);
        return { ...item, price: formatPrice(cents, currency) };
      }
      return item;
    });

    return { ...section, config: { ...config, items } } as PageSection;
  });

  return <SectionRenderer sections={sections} />;
}
