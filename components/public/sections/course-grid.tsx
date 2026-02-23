import type { PageSection } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getCoursePrice } from "@/lib/pricing";
import Link from "next/link";
import Image from "next/image";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";

interface CourseGridProps {
  section: PageSection;
}

export async function CourseGrid({ section }: CourseGridProps) {
  const currency = await getCurrency();
  const config = (section.config as Record<string, unknown>) || {};
  const featuredOnly = config.featuredOnly === true;
  const maxCount = (config.maxCount as number) || 6;

  const courses = await prisma.course.findMany({
    where: {
      isPublished: true,
      ...(featuredOnly ? { isFeatured: true } : {}),
    },
    orderBy: { sortOrder: "asc" },
    take: maxCount,
  });

  if (courses.length === 0) return null;

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
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden">
              <div className="relative aspect-video bg-brand-800">
                {course.imageUrl && (
                  <Image
                    src={course.imageUrl}
                    alt={course.title}
                    width={400}
                    height={225}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-3 pt-10">
                  <div className="mb-1.5 flex items-center gap-2">
                    {course.category && (
                      <Badge variant="outline" className="border-white/40 bg-white/10 text-xs text-white">
                        {course.category.replaceAll("_", " ")}
                      </Badge>
                    )}
                    {course.level && (
                      <span className="text-xs text-white/80">
                        {course.level}
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading text-lg font-semibold text-white">
                    {course.title}
                  </h3>
                </div>
              </div>
              <CardContent className="pt-3">
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
                    {formatPrice(getCoursePrice(course, currency), currency)}
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button className="flex-1" variant="outline" asChild>
                    <Link href={`/courses/${course.slug}`}>Learn More<span className="sr-only"> about {course.title}</span></Link>
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
        <div className="mt-8 text-center">
          <Button asChild>
            <Link href="/courses">View All Courses</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
