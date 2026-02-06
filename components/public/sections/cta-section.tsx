import type { PageSection } from "@/lib/generated/prisma";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CtaSectionProps {
  section: PageSection;
}

export function CtaSection({ section }: CtaSectionProps) {
  return (
    <section className="bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-16">
      <div className="mx-auto max-w-3xl text-center">
        {section.title && (
          <h2 className="font-heading text-3xl font-bold text-white">
            {section.title}
          </h2>
        )}
        {section.subtitle && (
          <p className="mt-3 text-lg text-white/90">{section.subtitle}</p>
        )}
        {section.ctaText && section.ctaLink && (
          <Button
            size="lg"
            variant="secondary"
            className="mt-6 bg-white text-brand-600 hover:bg-white/90"
            asChild
          >
            <Link href={section.ctaLink}>{section.ctaText}</Link>
          </Button>
        )}
      </div>
    </section>
  );
}
