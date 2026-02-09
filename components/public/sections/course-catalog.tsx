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
import { LayoutGrid, List } from "lucide-react";
import { CatalogFilterDrawer } from "./catalog-filter-drawer";

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
  viewMode?: string;
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
  viewMode = "grid",
}: CourseCatalogProps) {
  // Parse combined filter: "type:category" or just "category" (legacy)
  let typeFilter = "all";
  let categoryFilter = activeCategory;

  if (activeCategory.includes(":")) {
    const [t, c] = activeCategory.split(":");
    typeFilter = t;
    categoryFilter = c;
  }

  const currency = await getCurrency();

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
      price: getCoursePrice(c, currency),
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
      price: getModulePrice(m, currency),
      slug: `short/${m.standaloneSlug}`,
      moduleId: m.id,
      hasPreviewVideo: !!m.previewVideoUrl,
    })),
  ];

  function filterUrl(type: string, cat: string, view?: string) {
    const v = view || viewMode;
    const params = new URLSearchParams();
    if (type !== "all" || cat !== "all") {
      params.set("category", `${type}:${cat}`);
    }
    if (v === "list") {
      params.set("view", "list");
    }
    const qs = params.toString();
    return `/courses${qs ? `?${qs}` : ""}`;
  }

  function viewUrl(view: string) {
    return filterUrl(typeFilter, categoryFilter, view);
  }

  const isGrid = viewMode !== "list";

  // Shared filter sidebar content (used in desktop sidebar + mobile drawer)
  const filterContent = (
    <div className="space-y-6">
      {/* Type filter */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Type
        </h3>
        <div className="flex flex-col gap-1">
          {typeFilters.map((tf) => (
            <Button
              key={tf.value}
              variant="ghost"
              size="sm"
              className={`justify-start ${
                typeFilter === tf.value
                  ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-950 dark:text-brand-300"
                  : ""
              }`}
              asChild
            >
              <Link href={filterUrl(tf.value, categoryFilter)}>
                {tf.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Category
        </h3>
        <div className="flex flex-col gap-1">
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant="ghost"
              size="sm"
              className={`justify-start ${
                categoryFilter === cat.value
                  ? "bg-brand-50 text-brand-700 font-semibold dark:bg-brand-950 dark:text-brand-300"
                  : ""
              }`}
              asChild
            >
              <Link href={filterUrl(typeFilter, cat.value)}>
                {cat.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

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

        <div className="flex gap-8">
          {/* Sidebar — desktop only */}
          <aside className="hidden w-48 shrink-0 md:block">
            {filterContent}
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar: mobile filter + count + view toggle */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Mobile filter trigger */}
                <div className="md:hidden">
                  <CatalogFilterDrawer>{filterContent}</CatalogFilterDrawer>
                </div>
                <span className="text-sm text-muted-foreground">
                  {items.length} course{items.length !== 1 && "s"}
                </span>
              </div>

              {/* View toggle */}
              <div className="flex overflow-hidden rounded-md border">
                <Link
                  href={viewUrl("grid")}
                  aria-label="Grid view"
                  className={`inline-flex items-center justify-center px-2.5 py-1.5 transition-colors ${
                    isGrid
                      ? "bg-brand-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Link>
                <Link
                  href={viewUrl("list")}
                  aria-label="List view"
                  className={`inline-flex items-center justify-center px-2.5 py-1.5 transition-colors ${
                    !isGrid
                      ? "bg-brand-600 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Items */}
            {items.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                No courses found with these filters.
              </div>
            ) : isGrid ? (
              /* ─── Grid View ─── */
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <Card
                    key={`${item.type}-${item.id}`}
                    className="overflow-hidden"
                  >
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
                      {item.hasPreviewVideo && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-3 pt-10">
                        <div className="mb-1.5 flex items-center gap-2">
                          <Badge
                            variant={
                              item.type === "short" ? "secondary" : "outline"
                            }
                            className="border-white/40 bg-white/10 text-xs text-white"
                          >
                            {item.type === "short"
                              ? "Short Course"
                              : "Full Course"}
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
                          {item.modulesCount != null &&
                            item.modulesCount > 0 && (
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
                          <Link href={`/courses/${item.slug}`}>
                            Learn More
                          </Link>
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
            ) : (
              /* ─── List View ─── */
              <div className="space-y-4">
                {items.map((item) => (
                  <Card
                    key={`${item.type}-${item.id}`}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row">
                      <div className="relative sm:w-48 md:w-56 shrink-0">
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            width={224}
                            height={126}
                            sizes="(max-width: 640px) 100vw, 224px"
                            className="aspect-video w-full object-cover sm:h-full sm:aspect-auto"
                          />
                        )}
                        {item.hasPreviewVideo && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
                              <svg
                                className="ml-0.5 h-4 w-4 text-brand-600"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-3 pb-2 pt-8 sm:px-2 sm:pb-2 sm:pt-6">
                          <h3 className="font-heading text-base font-semibold text-white sm:text-sm">
                            {item.title}
                          </h3>
                        </div>
                      </div>
                      <CardContent className="flex flex-1 flex-col justify-between p-4 sm:py-4">
                        <div>
                          <div className="mb-1.5 flex items-center gap-2">
                            <Badge
                              variant={
                                item.type === "short" ? "secondary" : "outline"
                              }
                              className="text-xs"
                            >
                              {item.type === "short"
                                ? "Short Course"
                                : "Full Course"}
                            </Badge>
                            {item.category && (
                              <span className="text-xs text-muted-foreground">
                                {item.category.replaceAll("_", " ")}
                              </span>
                            )}
                          </div>
                          {item.subtitle && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-muted-foreground">
                              {item.modulesCount != null &&
                                item.modulesCount > 0 && (
                                  <span>{item.modulesCount} Modules</span>
                                )}
                              {item.hours && <span> | {item.hours}</span>}
                            </div>
                            <span className="text-lg font-semibold text-brand-600">
                              {formatPrice(item.price, currency)}
                            </span>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/courses/${item.slug}`}>
                                Learn More
                              </Link>
                            </Button>
                            <AddToCartButton
                              courseId={item.courseId}
                              moduleId={item.moduleId}
                              size="sm"
                              variant="default"
                              label="Add"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
