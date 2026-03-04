import { prisma } from "@/lib/prisma";

/**
 * Recompute and persist course.hours and course.modulesCount
 * from the actual modules/lectures in the database.
 *
 * Call after any lecture or module create/update/delete.
 */
export async function recalculateCourseStats(courseId: string) {
  const modules = await prisma.module.findMany({
    where: { courseId },
    select: {
      id: true,
      lectures: {
        select: { durationSeconds: true },
      },
    },
  });

  const modulesCount = modules.length;
  const totalSeconds = modules
    .flatMap((m) => m.lectures)
    .reduce((sum, l) => sum + (l.durationSeconds || 0), 0);

  const hours = formatCourseDuration(totalSeconds);

  await prisma.course.update({
    where: { id: courseId },
    data: { hours, modulesCount },
  });
}

function formatCourseDuration(totalSeconds: number): string | null {
  if (totalSeconds <= 0) return null;

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} Minutes`;

  const h = totalMinutes / 60;
  // Round to nearest half-hour
  const rounded = Math.round(h * 2) / 2;
  if (rounded === Math.floor(rounded)) {
    return `~${rounded} ${rounded === 1 ? "Hour" : "Hours"}`;
  }
  return `~${rounded} Hours`;
}
