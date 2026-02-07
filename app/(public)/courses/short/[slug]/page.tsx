export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";
import { PreviewVideoPlayer } from "@/components/public/preview-video-player";
import { BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = await prisma.module.findUnique({
    where: { standaloneSlug: slug },
    select: { standaloneTitle: true, title: true, standaloneDescription: true },
  });
  if (!mod) return {};
  return {
    title: mod.standaloneTitle || mod.title,
    description: mod.standaloneDescription || undefined,
  };
}

export default async function ShortCourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = await prisma.module.findUnique({
    where: { standaloneSlug: slug },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
        },
      },
      lectures: {
        where: { context: { not: "course_only" } },
        select: { id: true, title: true, durationSeconds: true, isPreview: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!mod || !mod.isStandalonePublished) {
    notFound();
  }

  const title = mod.standaloneTitle || mod.title;
  const description = mod.standaloneDescription || mod.description;
  const imageUrl = mod.standaloneImageUrl;
  const price = mod.standalonePrice || 0;

  // Calculate savings vs full course
  const fullCoursePrice = mod.course.price;
  const savingsPercent =
    fullCoursePrice > 0
      ? Math.round(((fullCoursePrice - price) / fullCoursePrice) * 100)
      : 0;

  // Other standalone modules from the same course
  const relatedModules = await prisma.module.findMany({
    where: {
      courseId: mod.courseId,
      isStandalonePublished: true,
      id: { not: mod.id },
    },
    select: {
      id: true,
      standaloneTitle: true,
      title: true,
      standaloneSlug: true,
      standalonePrice: true,
    },
    orderBy: { sortOrder: "asc" },
    take: 4,
  });

  return (
    <>
      {/* Hero — two-column: info left, preview video right */}
      <section className="bg-brand-50 px-4 py-16 dark:bg-brand-950/30">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
          {/* Left: info */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="secondary">Short Course</Badge>
              {mod.standaloneCategory && (
                <Badge variant="outline">
                  {mod.standaloneCategory.replaceAll("_", " ")}
                </Badge>
              )}
            </div>
            <h1 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700 lg:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mt-3 text-lg text-muted-foreground">
                {description}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-terracotta-500" />
                <span>
                  {mod.lectures.length} Lecture
                  {mod.lectures.length !== 1 && "s"}
                </span>
              </div>
            </div>

            {/* Price + CTA */}
            <div className="mt-8 flex items-center gap-4">
              <span className="text-3xl font-bold text-brand-600">
                {formatPrice(price)}
              </span>
              <AddToCartButton
                moduleId={mod.id}
                size="lg"
                label="Add to Cart"
              />
            </div>
          </div>

          {/* Right: preview video or image */}
          <div>
            {mod.previewVideoUrl ? (
              <PreviewVideoPlayer videoUrl={mod.previewVideoUrl} />
            ) : imageUrl ? (
              <div className="overflow-hidden rounded-xl">
                <Image
                  src={imageUrl}
                  alt={title}
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

      {/* Part of Full Course banner */}
      <section className="border-b bg-muted/30 px-4 py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              This short course is part of
            </p>
            <Link
              href={`/courses/${mod.course.slug}`}
              className="font-medium text-brand-600 hover:underline"
            >
              {mod.course.title}
            </Link>
          </div>
          {savingsPercent > 0 && (
            <Badge className="bg-terracotta-500 text-white">
              Save {savingsPercent}% with the full course
            </Badge>
          )}
        </div>
      </section>

      {/* Lecture list */}
      {mod.lectures.length > 0 && (
        <section className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-700">
              What&apos;s Included
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
            <div className="mt-6 space-y-3">
              {mod.lectures.map((lecture, i) => (
                <div
                  key={lecture.id}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3"
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm">{lecture.title}</span>
                  {lecture.durationSeconds && (
                    <span className="text-xs text-muted-foreground">
                      {Math.ceil(lecture.durationSeconds / 60)} min
                    </span>
                  )}
                  {lecture.isPreview && (
                    <Badge variant="outline" className="text-xs">
                      Preview
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Other Short Courses from same course */}
      {relatedModules.length > 0 && (
        <section className="bg-muted/50 px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-brand-700">
              Other Short Courses
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {relatedModules.map((rm) => (
                <Link
                  key={rm.id}
                  href={`/courses/short/${rm.standaloneSlug}`}
                  className="group flex items-center justify-between rounded-lg border bg-background p-4 transition-colors hover:border-brand-300"
                >
                  <span className="font-medium group-hover:text-brand-600">
                    {rm.standaloneTitle || rm.title}
                  </span>
                  {rm.standalonePrice != null && (
                    <span className="font-semibold text-brand-600">
                      {formatPrice(rm.standalonePrice)}
                    </span>
                  )}
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
              moduleId={mod.id}
              size="lg"
              variant="secondary"
              label={`Add to Cart — ${formatPrice(price)}`}
            />
            <Link
              href={`/courses/${mod.course.slug}`}
              className="inline-flex items-center justify-center rounded-md border border-white px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              View Full Course — {formatPrice(fullCoursePrice)}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
