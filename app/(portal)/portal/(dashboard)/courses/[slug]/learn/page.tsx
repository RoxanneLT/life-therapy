export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

/**
 * /portal/courses/[slug]/learn
 * Redirects to the first incomplete lecture or the first lecture.
 */
export default async function LearnPage({
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
            select: { id: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      studentId_courseId: { studentId: student.id, courseId: course.id },
    },
  });
  if (!enrollment) notFound();

  const allLectureIds = course.modules.flatMap((m) =>
    m.lectures.map((l) => l.id)
  );

  if (allLectureIds.length === 0) {
    redirect(`/portal/courses/${slug}`);
  }

  // Find first incomplete lecture
  const completedProgress = await prisma.lectureProgress.findMany({
    where: {
      studentId: student.id,
      lectureId: { in: allLectureIds },
      completed: true,
    },
    select: { lectureId: true },
  });
  const completedIds = new Set(completedProgress.map((p) => p.lectureId));

  const firstIncomplete = allLectureIds.find((id) => !completedIds.has(id));
  const targetId = firstIncomplete || allLectureIds[0];

  redirect(`/portal/courses/${slug}/learn/${targetId}`);
}
