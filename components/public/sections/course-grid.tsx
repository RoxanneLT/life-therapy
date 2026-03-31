import type { PageSection } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getCoursePrice, getModulePrice } from "@/lib/pricing";
import Link from "next/link";
import Image from "next/image";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";

interface CourseGridProps {
  section: PageSection;
}

interface GridItem {
  id: string;
  type: "full" | "short";
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  level?: string | null;
  price: number;
  slug: string;
  modulesCount?: number;
  hours?: string | null;
  courseId?: string;
  moduleId?: string;
}

export async function CourseGrid({ section }: CourseGridProps) {
  const currency = await getCurrency();
  const config = (section.config as Record<string, unknown>) || {};
  const featuredOnly = config.featuredOnly === true;
  const maxCount = (config.maxCount as number) || 6;

  const [courses, standaloneModules] = await Promise.all([
    prisma.course.findMany({
      where: {
        isPublished: true,
        ...(featuredOnly ? { isFeatured: true } : {}),
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.module.findMany({
      where: {
        isStandalonePublished: true,
        course: { isPublished: true },
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const items: GridItem[] = [
    ...courses.map((c) => ({
      id: c.id,
      type: "full" as const,
      title: c.title,
      subtitle: c.subtitle,
      imageUrl: c.imageUrl,
      category: c.category,
      level: c.level,
      price: getCoursePrice(c, currency),
      slug: c.slug,
      modulesCount: c.modulesCount,
      hours: c.hours,
      courseId: c.id,
    })),
    ...standaloneModules.map((m) => ({
      id: m.id,
      type: "short" as const,
      title: m.standaloneTitle || m.title,
      subtitle: m.standaloneDescription,
      imageUrl: m.standaloneImageUrl,
      category: m.standaloneCategory,
      level: null,
      price: getModulePrice(m, currency),
      slug: `short/${m.standaloneSlug}`,
      moduleId: m.id,
    })),
  ].slice(0, maxCount);

  if (items.length === 0) return null;

  return (
    <section className="px-4 py-10">
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
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={`${item.type}-${item.id}`} className="overflow-hidden">
              <div className="relative aspect-video bg-brand-800">
                {item.imageUrl && (
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    width={400}
                    height={225}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 via-black/40 to-transparent px-4 pb-3 pt-10">
                  <div className="mb-1.5 flex items-center gap-2">
                    <Badge
                      variant={item.type === "short" ? "secondary" : "outline-solid"}
                      className="border-white/40 bg-white/10 text-xs text-white"
                    >
                      {item.type === "short" ? "Short Course" : "Full Course"}
                    </Badge>
                    {item.category && (
                      <span className="text-xs text-white/80">
                        {item.category.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-white">
                    {item.title}
                  </h3>
                </div>
              </div>
              <CardContent className="pt-3">
                {item.subtitle && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {item.subtitle}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {item.modulesCount != null && item.modulesCount > 0 && (
                      <span>{item.modulesCount} Modules</span>
                    )}
                    {item.hours && <span> | {item.hours}</span>}
                  </div>
                  <span className="font-semibold text-brand-600">
                    {formatPrice(item.price, currency)}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" variant="outline" asChild>
                    <Link href={`/courses/${item.slug}`}>Learn More<span className="sr-only"> about {item.title}</span></Link>
                  </Button>
                  <AddToCartButton
                    courseId={item.courseId}
                    moduleId={item.moduleId}
                    size="default"
                    variant="default"
                    label="Add"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Button asChild>
            <Link href="/courses">View All Courses</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
