export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";
import {
  BookOpen,
  Clock,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PreviewVideoPlayer } from "@/components/public/preview-video-player";
import { getRelatedCourses } from "@/lib/recommendations";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) return {};
  return {
    title: course.title,
    description: course.shortDescription || course.subtitle || undefined,
  };
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      modules: {
        where: { isStandalonePublished: true },
        select: {
          id: true,
          standaloneTitle: true,
          title: true,
          standaloneSlug: true,
          standalonePrice: true,
          standaloneImageUrl: true,
          standaloneCategory: true,
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  const relatedCourses = await getRelatedCourses(course.id, 3);

  return (
    <>
      {/* Hero — two-column: info left, preview video / image right */}
      <section className="bg-brand-50 px-4 py-16 dark:bg-brand-950/30">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="mb-4 flex items-center gap-2">
              {course.category && (
                <Badge variant="outline">
                  {course.category.replaceAll("_", " ")}
                </Badge>
              )}
              {course.level && (
                <Badge variant="secondary">{course.level}</Badge>
              )}
            </div>
            <h1 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700 lg:text-4xl">
              {course.title}
            </h1>
            {course.subtitle && (
              <p className="mt-3 text-lg text-muted-foreground">
                {course.subtitle}
              </p>
            )}

            {/* Stats */}
            <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
              {course.modulesCount > 0 && (
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-terracotta-500" />
                  <span>{course.modulesCount} Modules</span>
                </div>
              )}
              {course.hours && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-terracotta-500" />
                  <span>{course.hours}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-terracotta-500" />
                <span>{course.level || "All Levels"}</span>
              </div>
            </div>

            {/* Price + CTA */}
            <div className="mt-8 flex items-center gap-4">
              <span className="text-3xl font-bold text-brand-600">
                {formatPrice(course.price)}
              </span>
              <AddToCartButton
                courseId={course.id}
                size="lg"
                label="Add to Cart"
              />
            </div>
          </div>

          {/* Right: preview video or course image */}
          <div>
            {course.previewVideoUrl ? (
              <PreviewVideoPlayer videoUrl={course.previewVideoUrl} />
            ) : course.imageUrl ? (
              <div className="overflow-hidden rounded-xl">
                <Image
                  src={course.imageUrl}
                  alt={course.title}
                  width={600}
                  height={400}
                  sizes="(max-width: 768px) 100vw, 66vw"
                  className="aspect-video w-full object-cover"
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Description */}
      {course.description && (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-700">
              What You&apos;ll Learn
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
            <div className="mt-6 space-y-4 text-muted-foreground leading-relaxed">
              {course.description.split("\n\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* What's included */}
      <section className="bg-muted/50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-700">
            What&apos;s Included
          </h2>
          <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              "Video lessons with AI-powered presentations",
              "Downloadable PDF worksheets",
              "Practical exercises and reflections",
              "Lifetime access to course materials",
              "Self-paced — learn on your schedule",
              "Certificate of completion",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-500" />
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Available as Short Courses */}
      {course.modules.length > 0 && (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-700">
              Available as Short Courses
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
            <p className="mt-4 text-sm text-muted-foreground">
              Not ready for the full course? Start with an individual module.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {course.modules.map((mod) => (
                <Link
                  key={mod.id}
                  href={`/courses/short/${mod.standaloneSlug}`}
                  className="group flex items-center gap-4 rounded-lg border p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                >
                  <div className="flex-1">
                    <h3 className="font-medium group-hover:text-brand-600">
                      {mod.standaloneTitle || mod.title}
                    </h3>
                    {mod.standaloneCategory && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {mod.standaloneCategory.replaceAll("_", " ")}
                      </Badge>
                    )}
                  </div>
                  {mod.standalonePrice != null && (
                    <span className="font-semibold text-brand-600">
                      {formatPrice(mod.standalonePrice)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related Courses */}
      {relatedCourses.length > 0 && (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-700">
              Related Courses
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCourses.map((rc) => (
                <Link
                  key={rc.id}
                  href={`/courses/${rc.slug}`}
                  className="group rounded-lg border p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                >
                  {rc.imageUrl && (
                    <Image
                      src={rc.imageUrl}
                      alt={rc.title}
                      width={300}
                      height={170}
                      className="mb-3 aspect-video w-full rounded object-cover"
                    />
                  )}
                  <h3 className="font-medium group-hover:text-brand-600">
                    {rc.title}
                  </h3>
                  <span className="mt-1 block text-sm font-semibold text-brand-600">
                    {formatPrice(rc.price)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-brand-500 px-4 py-16 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-2xl font-bold">
            Ready to Get Started?
          </h2>
          <p className="mt-2 text-white/80">
            Take the first step toward meaningful change today.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <AddToCartButton
              courseId={course.id}
              size="lg"
              variant="secondary"
              label={`Add to Cart — ${formatPrice(course.price)}`}
            />
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              asChild
            >
              <Link href="/courses">Browse All Courses</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
