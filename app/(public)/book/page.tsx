export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { SectionRenderer } from "@/components/public/section-renderer";
import { BookingWidget } from "@/components/public/booking/booking-widget";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Book a Session",
  description:
    "Book a free consultation or schedule a 1:1 coaching session with Roxanne Bouwer.",
};

export default async function BookPage() {
  const [page, settings] = await Promise.all([
    prisma.page.findUnique({
      where: { slug: "book" },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    }),
    getSiteSettings(),
  ]);

  if (!page?.isPublished) {
    notFound();
  }

  // Render hero section first, then booking widget, then remaining CMS sections
  const heroSections = page.sections.filter(
    (s) => s.sectionType === "hero"
  );
  const otherSections = page.sections.filter(
    (s) => s.sectionType !== "hero"
  );

  return (
    <>
      <SectionRenderer sections={heroSections} />
      {settings.bookingEnabled ? (
        <BookingWidget />
      ) : (
        <SectionRenderer sections={otherSections} />
      )}
      {settings.bookingEnabled && otherSections.length > 0 && (
        <SectionRenderer sections={otherSections} />
      )}
    </>
  );
}
