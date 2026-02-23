export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getModulePrice, getCoursePrice } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";
import { PreviewVideoPlayer } from "@/components/public/preview-video-player";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";
import { breadcrumbJsonLd, JsonLdScript } from "@/lib/json-ld";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = await prisma.module.findUnique({
    where: { standaloneSlug: slug },
    select: { standaloneTitle: true, title: true, standaloneDescription: true, standaloneImageUrl: true },
  });
  if (!mod) return {};
  return buildMetadata({
    title: mod.standaloneTitle || mod.title,
    description: mod.standaloneDescription,
    ogImageUrl: mod.standaloneImageUrl,
    route: `/courses/short/${slug}`,
  });
}

export default async function ShortCourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currency = await getCurrency();
  const mod = await prisma.module.findUnique({
    where: { standaloneSlug: slug },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          priceUsd: true,
          priceEur: true,
          priceGbp: true,
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
  const price = getModulePrice(mod, currency);

  const fullCoursePrice = getCoursePrice(mod.course, currency);

  // All standalone modules from the same course (for savings calc + display)
  const allSiblingModules = await prisma.module.findMany({
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
      standalonePriceUsd: true,
      standalonePriceEur: true,
      standalonePriceGbp: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  // Show up to 4 in the "Other Short Courses" section
  const relatedModules = allSiblingModules.slice(0, 4);

  // Calculate savings: buying all standalone modules individually vs full course
  const allModulesTotal =
    price + allSiblingModules.reduce((sum, rm) => sum + getModulePrice(rm, currency), 0);
  const savingsPercent =
    allModulesTotal > fullCoursePrice && allModulesTotal > 0
      ? Math.round(((allModulesTotal - fullCoursePrice) / allModulesTotal) * 100)
      : 0;

  const breadcrumbLd = await breadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Courses", href: "/courses" },
    { name: mod.standaloneTitle || mod.title, href: `/courses/short/${mod.standaloneSlug}` },
  ]);

  return (
    <>
      <JsonLdScript data={breadcrumbLd} />
      {/* Hero — branded background, preview video right */}
      <section
        className="relative bg-cover bg-center px-4 py-16"
        style={{
          backgroundImage: `url(${imageUrl || "/images/LT_grayBG.png"})`,
        }}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10">
          <div className="mx-auto max-w-6xl">
            <Link
              href="/courses"
              className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Courses
            </Link>
          </div>
          <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2 lg:items-center">
            {/* Left: info */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Badge className="bg-white/20 text-white hover:bg-white/30">Short Course</Badge>
                {mod.standaloneCategory && (
                  <Badge variant="outline" className="border-white/40 text-white">
                    {mod.standaloneCategory.replaceAll("_", " ")}
                  </Badge>
                )}
              </div>
              <h1 className="font-heading text-3xl font-bold uppercase tracking-wide text-white lg:text-4xl">
                {title}
              </h1>
              {description && (
                <p className="mt-3 text-lg text-white/80">
                  {description}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-6 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-terracotta-400" />
                  <span>
                    {mod.lectures.length} Lecture
                    {mod.lectures.length !== 1 && "s"}
                  </span>
                </div>
              </div>

              {/* Price + CTA */}
              <div className="mt-8 flex items-center gap-4">
                <span className="text-3xl font-bold text-white">
                  {formatPrice(price, currency)}
                </span>
                <AddToCartButton
                  moduleId={mod.id}
                  size="lg"
                  label="Add to Cart"
                />
              </div>
            </div>

            {/* Right: preview video only */}
            {mod.previewVideoUrl && (
              <div>
                <PreviewVideoPlayer videoUrl={mod.previewVideoUrl} />
              </div>
            )}
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
                      {formatPrice(getModulePrice(rm, currency), currency)}
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
              label={`Add to Cart — ${formatPrice(price, currency)}`}
            />
            <Link
              href={`/courses/${mod.course.slug}`}
              className="inline-flex items-center justify-center rounded-md border border-white px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              View Full Course — {formatPrice(fullCoursePrice, currency)}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
