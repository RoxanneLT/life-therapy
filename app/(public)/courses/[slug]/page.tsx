export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Clock,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
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
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  return (
    <>
      {/* Hero */}
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
              <Button size="lg" asChild>
                <Link href="/book">Enrol Now</Link>
              </Button>
            </div>
          </div>

          {/* Course image */}
          {course.imageUrl && (
            <div className="overflow-hidden rounded-xl">
              <Image
                src={course.imageUrl}
                alt={course.title}
                width={600}
                height={400}
                className="aspect-video w-full object-cover"
              />
            </div>
          )}
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
            <Button size="lg" variant="secondary" asChild>
              <Link href="/book">Enrol Now — {formatPrice(course.price)}</Link>
            </Button>
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
