export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { CourseCard } from "@/components/portal/course-card";
import { GraduationCap } from "lucide-react";
import Link from "next/link";

export default async function MyCoursesPage() {
  const { student } = await requirePasswordChanged();

  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id },
    include: {
      course: {
        include: {
          modules: {
            include: { lectures: { select: { id: true } } },
          },
        },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  // Get completed lecture counts per enrollment
  const enriched = await Promise.all(
    enrollments.map(async (enrollment) => {
      const allLectureIds = enrollment.course.modules.flatMap((m) =>
        m.lectures.map((l) => l.id)
      );
      const completedLectures = allLectureIds.length > 0
        ? await prisma.lectureProgress.count({
            where: {
              studentId: student.id,
              lectureId: { in: allLectureIds },
              completed: true,
            },
          })
        : 0;

      return {
        enrollment,
        totalLectures: allLectureIds.length,
        completedLectures,
      };
    })
  );

  if (enrollments.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-heading text-2xl font-bold">My Courses</h1>
        <div className="flex flex-col items-center py-16 text-center">
          <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="font-heading text-lg font-semibold">
            No courses yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse our catalog and start your learning journey.
          </p>
          <Link
            href="/courses"
            className="mt-4 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Browse Courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">My Courses</h1>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {enriched.map(({ enrollment, totalLectures, completedLectures }) => (
          <CourseCard
            key={enrollment.id}
            slug={enrollment.course.slug}
            title={enrollment.course.title}
            subtitle={enrollment.course.subtitle}
            imageUrl={enrollment.course.imageUrl}
            progressPercent={enrollment.progressPercent}
            completedAt={enrollment.completedAt}
            totalLectures={totalLectures}
            completedLectures={completedLectures}
          />
        ))}
      </div>
    </div>
  );
}
