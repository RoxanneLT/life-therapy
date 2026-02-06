export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/portal/progress-bar";
import {
  PlayCircle,
  FileText,
  HelpCircle,
  Clock,
  BookOpen,
  Award,
  CheckCircle2,
} from "lucide-react";

export default async function CourseOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { student } = await requirePasswordChanged();

  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lectures: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              title: true,
              lectureType: true,
              durationSeconds: true,
            },
          },
          quiz: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!course) notFound();

  // Verify enrollment
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
  });

  if (!enrollment) notFound();

  // Get progress
  const allLectureIds = course.modules.flatMap((m) =>
    m.lectures.map((l) => l.id)
  );
  const completedProgress = allLectureIds.length > 0
    ? await prisma.lectureProgress.findMany({
        where: {
          studentId: student.id,
          lectureId: { in: allLectureIds },
          completed: true,
        },
        select: { lectureId: true },
      })
    : [];
  const completedIds = new Set(completedProgress.map((p) => p.lectureId));

  // Find the first incomplete lecture for "Continue" button
  const firstIncomplete = course.modules
    .flatMap((m) => m.lectures)
    .find((l) => !completedIds.has(l.id));

  const certificate = await prisma.certificate.findUnique({
    where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
  });

  const totalDuration = course.modules
    .flatMap((m) => m.lectures)
    .reduce((sum, l) => sum + (l.durationSeconds || 0), 0);

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="flex flex-col gap-6 md:flex-row">
        {course.imageUrl && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg md:w-80">
            <Image
              src={course.imageUrl}
              alt={course.title}
              fill
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold">{course.title}</h1>
          {course.subtitle && (
            <p className="mt-1 text-muted-foreground">{course.subtitle}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {allLectureIds.length} lectures
            </span>
            {totalDuration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {Math.round(totalDuration / 3600)}h{" "}
                {Math.round((totalDuration % 3600) / 60)}m
              </span>
            )}
            <span className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              {course.modules.length} modules
            </span>
          </div>

          <div className="mt-4">
            <ProgressBar
              value={enrollment.progressPercent}
              showLabel
              size="md"
            />
          </div>

          <div className="mt-4 flex gap-3">
            <Button asChild>
              <Link
                href={
                  firstIncomplete
                    ? `/portal/courses/${slug}/learn/${firstIncomplete.id}`
                    : `/portal/courses/${slug}/learn/${allLectureIds[0] || ""}`
                }
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                {enrollment.progressPercent > 0 ? "Continue Learning" : "Start Course"}
              </Link>
            </Button>
            {certificate && (
              <Button variant="outline" asChild>
                <Link href="/portal/certificates">
                  <Award className="mr-2 h-4 w-4" />
                  View Certificate
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Course content */}
      <div className="space-y-4">
        <h2 className="font-heading text-lg font-semibold">Course Content</h2>
        {course.modules.map((mod, modIdx) => {
          const modLectureIds = mod.lectures.map((l) => l.id);
          const modCompleted = modLectureIds.filter((id) =>
            completedIds.has(id)
          ).length;

          return (
            <Card key={mod.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>
                    Module {modIdx + 1}: {mod.title}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {modCompleted}/{mod.lectures.length} complete
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {mod.lectures.map((lecture) => (
                  <Link
                    key={lecture.id}
                    href={`/portal/courses/${slug}/learn/${lecture.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    {completedIds.has(lecture.id) ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                    ) : lecture.lectureType === "video" ? (
                      <PlayCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    )}
                    <span className="flex-1">{lecture.title}</span>
                    {lecture.durationSeconds && (
                      <span className="text-xs text-muted-foreground">
                        {Math.ceil(lecture.durationSeconds / 60)}min
                      </span>
                    )}
                  </Link>
                ))}
                {mod.quiz && (
                  <Link
                    href={`/portal/courses/${slug}/learn/quiz-${mod.quiz.id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                  >
                    <HelpCircle className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <span className="flex-1">{mod.quiz.title}</span>
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
