import type { PageSection } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";

const categories = [
  { value: "all", label: "All" },
  { value: "self_esteem", label: "Self-Esteem" },
  { value: "mental_wellness", label: "Mental Wellness" },
  { value: "relationships", label: "Relationships" },
  { value: "specialised", label: "Specialised" },
];

const typeFilters = [
  { value: "all", label: "All Courses" },
  { value: "full", label: "Full Courses" },
  { value: "short", label: "Short Courses" },
];

interface CourseCatalogProps {
  section: PageSection;
  activeCategory?: string;
}

interface CatalogItem {
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
  hasPreviewVideo: boolean;
}

export async function CourseCatalog({
  section,
  activeCategory = "all",
}: CourseCatalogProps) {
  // Parse combined filter: "type:category" or just "category" (legacy)
  let typeFilter = "all";
  let categoryFilter = activeCategory;

  if (activeCategory.includes(":")) {
    const [t, c] = activeCategory.split(":");
    typeFilter = t;
    categoryFilter = c;
  }

  const categoryWhere =
    categoryFilter !== "all" ? { category: categoryFilter } : {};

  const [courses, standaloneModules] = await Promise.all([
    typeFilter !== "short"
      ? prisma.course.findMany({
          where: { isPublished: true, ...categoryWhere },
          orderBy: { sortOrder: "asc" },
        })
      : [],
    typeFilter !== "full"
      ? prisma.module.findMany({
          where: {
            isStandalonePublished: true,
            ...(categoryFilter !== "all"
              ? { standaloneCategory: categoryFilter }
              : {}),
          },
          orderBy: { sortOrder: "asc" },
        })
      : [],
  ]);

  // Unify into a single list
  const items: CatalogItem[] = [
    ...courses.map((c) => ({
      id: c.id,
      type: "full" as const,
      title: c.title,
      subtitle: c.subtitle,
      imageUrl: c.imageUrl,
      category: c.category,
      level: c.level,
      price: c.price,
      slug: c.slug,
      modulesCount: c.modulesCount,
      hours: c.hours,
      courseId: c.id,
      hasPreviewVideo: !!c.previewVideoUrl,
    })),
    ...standaloneModules.map((m) => ({
      id: m.id,
      type: "short" as const,
      title: m.standaloneTitle || m.title,
      subtitle: m.standaloneDescription,
      imageUrl: m.standaloneImageUrl,
      category: m.standaloneCategory,
      level: null,
      price: m.standalonePrice || 0,
      slug: `short/${m.standaloneSlug}`,
      moduleId: m.id,
      hasPreviewVideo: !!m.previewVideoUrl,
    })),
  ];

  function filterUrl(type: string, cat: string) {
    if (type === "all" && cat === "all") return "/courses";
    return `/courses?category=${type}:${cat}`;
  }

  return (
    <section className="px-4 py-12">
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

        {/* Filters */}
        <div className="mb-8 space-y-3">
          {/* Type filter */}
          <div className="flex flex-wrap justify-center gap-2">
            {typeFilters.map((tf) => (
              <Button
                key={tf.value}
                variant={typeFilter === tf.value ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link href={filterUrl(tf.value, categoryFilter)}>
                  {tf.label}
                </Link>
              </Button>
            ))}
          </div>
          {/* Category filter */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <Button
                key={cat.value}
                variant={categoryFilter === cat.value ? "default" : "ghost"}
                size="sm"
                asChild
              >
                <Link href={filterUrl(typeFilter, cat.value)}>
                  {cat.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {items.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No courses found with these filters.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={`${item.type}-${item.id}`} className="overflow-hidden">
                {item.imageUrl && (
                  <div className="relative">
                    <Image
                      src={item.imageUrl}
                      alt={item.title}
                      width={400}
                      height={225}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="aspect-video w-full object-cover"
                    />
                    {item.hasPreviewVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                          <svg
                            className="ml-1 h-5 w-5 text-brand-600"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <CardContent className={item.imageUrl ? "pt-4" : "pt-6"}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge
                      variant={item.type === "short" ? "secondary" : "outline"}
                      className="text-xs"
                    >
                      {item.type === "short" ? "Short Course" : "Full Course"}
                    </Badge>
                    {item.category && (
                      <span className="text-xs text-muted-foreground">
                        {item.category.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading text-lg font-semibold">
                    {item.title}
                  </h3>
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
                      {formatPrice(item.price)}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1" variant="outline" asChild>
                      <Link href={`/courses/${item.slug}`}>Learn More</Link>
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
        )}
      </div>
    </section>
  );
}
