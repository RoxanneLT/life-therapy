import type { PageSection } from "@/lib/generated/prisma";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface HeroSectionProps {
  section: PageSection;
}

export function HeroSection({ section }: HeroSectionProps) {
  const config = (section.config as Record<string, string>) || {};

  return (
    <section
      className="relative flex min-h-[500px] items-center justify-center bg-gradient-to-br from-brand-50 via-cream-50 to-brand-100 px-4 py-20"
      style={
        section.imageUrl
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${section.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      <div className="mx-auto max-w-3xl text-center">
        <h1
          className={`font-heading text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl ${
            section.imageUrl ? "text-white" : "text-foreground"
          }`}
        >
          {section.title}
        </h1>
        {section.subtitle && (
          <p
            className={`mx-auto mt-4 max-w-2xl text-lg ${
              section.imageUrl
                ? "text-white/90"
                : "text-muted-foreground"
            }`}
          >
            {section.subtitle}
          </p>
        )}
        {(section.ctaText || config.ctaSecondaryText) && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {section.ctaText && section.ctaLink && (
              <Button size="lg" asChild>
                <Link href={section.ctaLink}>{section.ctaText}</Link>
              </Button>
            )}
            {config.ctaSecondaryText && config.ctaSecondaryLink && (
              <Button size="lg" variant="outline" asChild>
                <Link href={config.ctaSecondaryLink}>
                  {config.ctaSecondaryText}
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
