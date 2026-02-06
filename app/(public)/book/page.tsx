export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { getOptionalStudent } from "@/lib/student-auth";
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
  const [page, settings, student] = await Promise.all([
    prisma.page.findUnique({
      where: { slug: "book" },
      include: { sections: { orderBy: { sortOrder: "asc" } } },
    }),
    getSiteSettings(),
    getOptionalStudent(),
  ]);

  if (!page?.isPublished) {
    notFound();
  }

  // Fetch credit balance if student is logged in
  let creditBalance = 0;
  if (student) {
    const bal = await prisma.sessionCreditBalance.findUnique({
      where: { studentId: student.id },
    });
    creditBalance = bal?.balance ?? 0;
  }

  // Split sections by type for controlled layout order
  const heroSections = page.sections.filter((s) => s.sectionType === "hero");
  const stepsSections = page.sections.filter((s) => s.sectionType === "steps");
  const faqSections = page.sections.filter((s) => s.sectionType === "faq");
  // Exclude pricing (widget replaces it) and types already rendered above
  const remainingSections = page.sections.filter(
    (s) =>
      s.sectionType !== "hero" &&
      s.sectionType !== "steps" &&
      s.sectionType !== "pricing" &&
      s.sectionType !== "faq"
  );

  return (
    <>
      {/* Hero */}
      <SectionRenderer sections={heroSections} />

      {/* How it Works (steps) */}
      {stepsSections.length > 0 && <SectionRenderer sections={stepsSections} />}

      {/* Booking widget with anchor for auto-scroll */}
      {settings.bookingEnabled && (
        <div id="booking">
          <BookingWidget creditBalance={creditBalance} />
        </div>
      )}

      {/* FAQ */}
      {faqSections.length > 0 && <SectionRenderer sections={faqSections} />}

      {/* Any remaining CTA sections */}
      {remainingSections.length > 0 && (
        <SectionRenderer sections={remainingSections} />
      )}

      {/* Fallback: show all CMS sections when booking is disabled */}
      {!settings.bookingEnabled && (
        <SectionRenderer
          sections={page.sections.filter((s) => s.sectionType !== "hero")}
        />
      )}
    </>
  );
}
