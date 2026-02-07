export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { CourseCard } from "@/components/portal/course-card";
import { GraduationCap } from "lucide-react";
import Link from "next/link";

export default async function MyCoursesPage() {
  const { student } = await requirePasswordChanged();

  const [enrollments, moduleAccessRecords] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: {
        course: {
          include: {
            modules: {
              include: {
                lectures: {
                  where: { context: { not: "standalone_only" } },
                  select: { id: true },
                },
              },
            },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.moduleAccess.findMany({
      where: { studentId: student.id },
      include: {
        module: {
          include: {
            course: { select: { slug: true, title: true } },
            lectures: {
              where: { context: { not: "course_only" } },
              select: { id: true },
            },
          },
        },
      },
      orderBy: { grantedAt: "desc" },
    }),
  ]);

  // Filter out module access for courses where student has full enrollment
  const enrolledCourseIds = new Set(enrollments.map((e) => e.course.id));
  const standaloneAccess = moduleAccessRecords.filter(
    (ma) => !enrolledCourseIds.has(ma.module.courseId)
  );

  // Get completed lecture counts per enrollment
  const enrichedCourses = await Promise.all(
    enrollments.map(async (enrollment) => {
      const allLectureIds = enrollment.course.modules.flatMap((m) =>
        m.lectures.map((l) => l.id)
      );
      const completedLectures =
        allLectureIds.length > 0
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

  // Get completed lecture counts per module access
  const enrichedModules = await Promise.all(
    standaloneAccess.map(async (ma) => {
      const lectureIds = ma.module.lectures.map((l) => l.id);
      const completedLectures =
        lectureIds.length > 0
          ? await prisma.lectureProgress.count({
              where: {
                studentId: student.id,
                lectureId: { in: lectureIds },
                completed: true,
              },
            })
          : 0;

      const totalLectures = lectureIds.length;
      const progressPercent =
        totalLectures > 0
          ? Math.round((completedLectures / totalLectures) * 100)
          : 0;

      return {
        moduleAccess: ma,
        totalLectures,
        completedLectures,
        progressPercent,
      };
    })
  );

  const hasContent = enrollments.length > 0 || standaloneAccess.length > 0;

  if (!hasContent) {
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

      {enrichedCourses.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {enrichedCourses.map(
            ({ enrollment, totalLectures, completedLectures }) => (
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
            )
          )}
        </div>
      )}

      {enrichedModules.length > 0 && (
        <>
          <h2 className="font-heading text-lg font-semibold">
            My Short Courses
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {enrichedModules.map(
              ({
                moduleAccess: ma,
                totalLectures,
                completedLectures,
                progressPercent,
              }) => (
                <CourseCard
                  key={ma.id}
                  slug={`${ma.module.course.slug}?module=${ma.module.id}`}
                  title={ma.module.standaloneTitle || ma.module.title}
                  subtitle={`Part of ${ma.module.course.title}`}
                  imageUrl={ma.module.standaloneImageUrl}
                  progressPercent={progressPercent}
                  completedAt={null}
                  totalLectures={totalLectures}
                  completedLectures={completedLectures}
                />
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
