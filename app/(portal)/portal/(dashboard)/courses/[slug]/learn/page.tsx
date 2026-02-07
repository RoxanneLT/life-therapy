export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { checkCourseAccess, filterLecturesByContext } from "@/lib/access";
import { notFound, redirect } from "next/navigation";

/**
 * /portal/courses/[slug]/learn
 * Redirects to the first incomplete lecture or the first lecture.
 * Supports both full course enrollments and module-only access.
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
            select: { id: true, context: true },
          },
        },
      },
    },
  });

  if (!course) notFound();

  const access = await checkCourseAccess(student.id, course.id);
  if (access.type === "none") notFound();

  const isModuleOnly = access.type === "partial";
  const accessedModuleIds = isModuleOnly ? new Set(access.moduleIds) : null;

  // Filter modules and lectures by access type
  const visibleModules = isModuleOnly
    ? course.modules.filter((m) => accessedModuleIds!.has(m.id))
    : course.modules;

  const contextType = isModuleOnly ? "module" : "course";
  const allLectureIds = visibleModules.flatMap((m) =>
    filterLecturesByContext(m.lectures, contextType).map((l) => l.id)
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
