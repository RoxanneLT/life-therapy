import type { PageSection } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

interface HeroSectionProps {
  section: PageSection;
}

export function HeroSection({ section }: HeroSectionProps) {
  const config = (section.config as Record<string, string>) || {};

  return (
    <section
      className={`relative flex min-h-[400px] items-center px-4 py-12 ${
        section.imageUrl ? "" : "bg-gradient-to-br from-brand-50 via-cream-50 to-brand-100"
      }`}
    >
      {section.imageUrl && (
        <>
          <Image
            src={section.imageUrl}
            alt=""
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-black/30" />
        </>
      )}
      <div className="relative mx-auto w-full max-w-6xl">
        <h1
          className={`font-heading text-3xl font-bold uppercase tracking-wide leading-tight sm:text-4xl lg:text-6xl ${
            section.imageUrl ? "text-white" : "text-foreground"
          }`}
        >
          {section.title}
        </h1>
        <div className="mt-3 h-[3px] w-16 bg-terracotta-500" />
        {section.subtitle && (
          <p
            className={`mt-4 max-w-2xl text-lg ${
              section.imageUrl
                ? "text-white/90"
                : "text-muted-foreground"
            }`}
          >
            {section.subtitle}
          </p>
        )}
        {(section.ctaText || config.ctaSecondaryText) && (
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {section.ctaText && section.ctaLink && (
              <Button
                size="lg"
                className={section.imageUrl ? "bg-terracotta-500 text-white hover:bg-terracotta-600" : ""}
                asChild
              >
                <Link href={section.ctaLink}>{section.ctaText}</Link>
              </Button>
            )}
            {config.ctaSecondaryText && config.ctaSecondaryLink && (
              <Button
                size="lg"
                variant="outline"
                className={section.imageUrl ? "border-white/60 bg-transparent text-white hover:bg-white/10" : ""}
                asChild
              >
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
