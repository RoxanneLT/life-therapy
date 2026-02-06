import type { PageSection } from "@/lib/generated/prisma/client";

interface TextSectionProps {
  section: PageSection;
}

export function TextSection({ section }: TextSectionProps) {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        {section.title && (
          <div className="mb-6">
            <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700">
              {section.title}
            </h2>
            <div className="mt-3 h-[3px] w-16 bg-terracotta-500" />
          </div>
        )}
        {section.content && (
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            {section.content.split("\n\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
