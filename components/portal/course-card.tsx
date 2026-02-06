"use client";

import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, CheckCircle2 } from "lucide-react";

interface CourseCardProps {
  slug: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  progressPercent: number;
  completedAt?: Date | null;
  totalLectures: number;
  completedLectures: number;
}

export function CourseCard({
  slug,
  title,
  subtitle,
  imageUrl,
  progressPercent,
  completedAt,
  totalLectures,
  completedLectures,
}: CourseCardProps) {
  const isComplete = !!completedAt;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-video bg-muted">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <PlayCircle className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        {isComplete && (
          <div className="absolute right-2 top-2 rounded-full bg-green-500 p-1">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        )}
      </div>
      <CardContent className="p-4">
        <h3 className="font-heading text-base font-semibold line-clamp-2">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
            {subtitle}
          </p>
        )}

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedLectures}/{totalLectures} lectures
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <Button className="mt-4 w-full" size="sm" asChild>
          <Link href={`/portal/courses/${slug}`}>
            {isComplete ? "Review" : progressPercent > 0 ? "Continue" : "Start"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
