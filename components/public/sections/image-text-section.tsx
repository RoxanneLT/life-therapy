import type { PageSection } from "@/lib/generated/prisma/client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";

interface ImageTextSectionProps {
  section: PageSection;
}

export function ImageTextSection({ section }: ImageTextSectionProps) {
  const config = (section.config as Record<string, string>) || {};
  const imageLeft = config.imagePosition === "left";
  return (
    <section className="px-4 py-10">
      <div
        className={`mx-auto flex max-w-6xl flex-col items-center gap-8 md:flex-row ${
          imageLeft ? "" : "md:flex-row-reverse"
        }`}
      >
        {/* Image */}
        {section.imageUrl && (
          <div className="flex w-full items-center justify-center md:w-1/2">
            <Image
              src={section.imageUrl}
              alt={section.imageAlt || section.title || ""}
              width={600}
              height={400}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="max-h-[400px] w-auto rounded-xl object-contain"
            />
          </div>
        )}

        {/* Text */}
        <div className={`w-full ${section.imageUrl ? "md:w-1/2" : ""}`}>
          {section.title && (
            <div className="mb-4">
              <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700">
                {section.title}
              </h2>
              <div className="mt-3 h-[3px] w-16 bg-terracotta-500" />
            </div>
          )}
          {section.content && (
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              {section.content.split("\n\n").map((paragraph, i) => (
                <p key={i}>
                  {paragraph.split("\n").map((line, j, arr) => (
                    <span key={j}>
                      {line}
                      {j < arr.length - 1 && <br />}
                    </span>
                  ))}
                </p>
              ))}
            </div>
          )}
          {section.ctaText && section.ctaLink && (
            <Button className="mt-6" asChild>
              <Link href={section.ctaLink}>{section.ctaText}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
