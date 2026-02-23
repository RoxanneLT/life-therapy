import type { PageSection } from "@/lib/generated/prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Video,
  BookOpen,
  Package,
  Award,
  Brain,
  Globe,
  Heart,
  Star,
  Users,
  Mail,
  Phone,
  Clock,
  MapPin,
  Shield,
  Sparkles,
  MessageCircle,
  Calendar,
} from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Video,
  BookOpen,
  Package,
  Award,
  Brain,
  Globe,
  Heart,
  Star,
  Users,
  Mail,
  Phone,
  Clock,
  MapPin,
  Shield,
  Sparkles,
  MessageCircle,
  Calendar,
};

interface FeatureItem {
  icon?: string;
  title: string;
  description: string;
  link?: string;
  linkText?: string;
}

interface FeaturesSectionProps {
  section: PageSection;
}

export function FeaturesSection({ section }: FeaturesSectionProps) {
  const config = (section.config as { items?: FeatureItem[] }) || {};
  const items = config.items || [];

  if (items.length === 0) return null;

  return (
    <section className="bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-6xl">
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
          className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${
            items.length <= 3 || items.length % 3 === 0
              ? "lg:grid-cols-3"
              : "lg:grid-cols-4"
          }`}
        >
          {items.map((item, i) => {
            const Icon = item.icon ? iconMap[item.icon] : null;
            return (
              <Card key={i}>
                <CardContent className="pt-6">
                  {Icon && (
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta-50 text-terracotta-500">
                      <Icon className="h-5 w-5" />
                    </div>
                  )}
                  <h3 className="font-semibold">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {item.link && item.linkText && (
                    <Button
                      variant="link"
                      className="mt-2 h-auto p-0 text-brand-600"
                      asChild
                    >
                      <Link href={item.link}>{item.linkText} &rarr;</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
