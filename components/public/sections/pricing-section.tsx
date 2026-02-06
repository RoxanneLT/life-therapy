import type { PageSection } from "@/lib/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Sparkles,
  Video,
  Users,
  Calendar,
  MessageCircle,
  Clock,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Video,
  Users,
  Calendar,
  MessageCircle,
  Clock,
};

interface PricingItem {
  icon?: string;
  title: string;
  description: string;
  price: string;
  priceNote?: string;
  ctaText: string;
  ctaLink: string;
  highlight?: boolean;
}

interface PricingSectionProps {
  section: PageSection;
}

export function PricingSection({ section }: PricingSectionProps) {
  const config = (section.config as { items?: PricingItem[]; footnote?: string }) || {};
  const items = config.items || [];

  if (items.length === 0) return null;

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-5xl">
        {section.title && (
          <div className="mb-2 text-center">
            <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700">
              {section.title}
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
          </div>
        )}
        {section.subtitle && (
          <p className="mb-8 text-center text-muted-foreground">
            {section.subtitle}
          </p>
        )}
        <div
          className={`mt-10 grid gap-6 ${
            items.length <= 2
              ? "sm:grid-cols-2 max-w-4xl mx-auto"
              : "sm:grid-cols-3"
          }`}
        >
          {items.map((item, i) => {
            const Icon = item.icon ? iconMap[item.icon] : null;
            return (
              <Card key={i} className={item.highlight ? "border-brand-500" : ""}>
                <CardContent className="pt-6 text-center">
                  {Icon && (
                    <Icon className={`mx-auto h-8 w-8 ${item.highlight ? "text-terracotta-500" : "text-brand-500"}`} />
                  )}
                  <h3 className="mt-4 font-heading text-xl font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                  <p className="mt-4 text-3xl font-bold text-brand-600">
                    {item.price}
                  </p>
                  {item.priceNote && (
                    <p className="text-xs text-muted-foreground">
                      {item.priceNote}
                    </p>
                  )}
                  <Button
                    className="mt-6 w-full"
                    variant={item.highlight ? "outline" : "default"}
                    asChild
                  >
                    <Link href={item.ctaLink}>{item.ctaText}</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {config.footnote && (
          <p
            className="mt-6 text-center text-sm text-muted-foreground [&_a]:text-brand-600 [&_a]:underline [&_a]:hover:text-brand-700"
            dangerouslySetInnerHTML={{ __html: config.footnote }}
          />
        )}
      </div>
    </section>
  );
}
