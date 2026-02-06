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
  { value: "all", label: "All Courses" },
  { value: "self_esteem", label: "Self-Esteem" },
  { value: "mental_wellness", label: "Mental Wellness" },
  { value: "relationships", label: "Relationships" },
  { value: "specialised", label: "Specialised" },
];

interface CourseCatalogProps {
  section: PageSection;
  activeCategory?: string;
}

export async function CourseCatalog({
  section,
  activeCategory = "all",
}: CourseCatalogProps) {
  const courses = await prisma.course.findMany({
    where: {
      isPublished: true,
      ...(activeCategory !== "all" ? { category: activeCategory } : {}),
    },
    orderBy: { sortOrder: "asc" },
  });

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

        {/* Category tabs */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <Button
              key={cat.value}
              variant={activeCategory === cat.value ? "default" : "outline"}
              size="sm"
              asChild
            >
              <Link
                href={
                  cat.value === "all"
                    ? "/courses"
                    : `/courses?category=${cat.value}`
                }
              >
                {cat.label}
              </Link>
            </Button>
          ))}
        </div>

        {/* Course grid */}
        {courses.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            No courses found in this category.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Card key={course.id} className="overflow-hidden">
                {course.imageUrl && (
                  <Image
                    src={course.imageUrl}
                    alt={course.title}
                    width={400}
                    height={225}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="aspect-video w-full object-cover"
                  />
                )}
                <CardContent className={course.imageUrl ? "pt-4" : "pt-6"}>
                  <div className="mb-2 flex items-center gap-2">
                    {course.category && (
                      <Badge variant="outline" className="text-xs">
                        {course.category.replaceAll("_", " ")}
                      </Badge>
                    )}
                    {course.level && (
                      <span className="text-xs text-muted-foreground">
                        {course.level}
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading text-lg font-semibold">
                    {course.title}
                  </h3>
                  {course.subtitle && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {course.subtitle}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {course.modulesCount > 0 && (
                        <span>{course.modulesCount} Modules</span>
                      )}
                      {course.hours && <span> | {course.hours}</span>}
                    </div>
                    <span className="font-semibold text-brand-600">
                      {formatPrice(course.price)}
                    </span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button className="flex-1" variant="outline" asChild>
                      <Link href={`/courses/${course.slug}`}>Learn More</Link>
                    </Button>
                    <AddToCartButton
                      courseId={course.id}
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
