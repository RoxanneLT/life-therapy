import type { PageSection } from "@/lib/generated/prisma/client";

interface StepItem {
  title: string;
  description: string;
}

interface StepsSectionProps {
  section: PageSection;
}

export function StepsSection({ section }: StepsSectionProps) {
  const config = (section.config as { items?: StepItem[] }) || {};
  const items = config.items || [];

  if (items.length === 0) return null;

  return (
    <section className="bg-muted/50 px-4 py-10">
      <div className="mx-auto max-w-3xl text-center">
        {section.title && (
          <>
            <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700">
              {section.title}
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
          </>
        )}
        {section.subtitle && (
          <p className="mt-4 text-muted-foreground">{section.subtitle}</p>
        )}
        <div
          className={`mt-10 grid grid-cols-1 gap-4 sm:gap-8 text-left ${
            items.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {items.map((item, i) => (
            <div key={i} className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-xl font-bold text-white">
                {i + 1}
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">
                {item.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
