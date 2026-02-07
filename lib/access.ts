import { prisma } from "./prisma";

type AccessType = "course" | "module" | "none";

/**
 * Check if a student has access to a lecture via its module and course.
 * Pass moduleId and courseId directly when already known (avoids extra DB lookup).
 * If only lectureId is known, pass it as the second arg and omit courseId.
 */
export async function checkLectureAccess(
  studentId: string,
  moduleIdOrLectureId: string,
  courseId?: string
): Promise<{ type: AccessType; moduleId?: string; courseId?: string }> {
  let moduleId: string;
  let resolvedCourseId: string;

  if (courseId) {
    moduleId = moduleIdOrLectureId;
    resolvedCourseId = courseId;
  } else {
    const lecture = await prisma.lecture.findUnique({
      where: { id: moduleIdOrLectureId },
      select: { moduleId: true, module: { select: { courseId: true } } },
    });
    if (!lecture) return { type: "none" };
    moduleId = lecture.moduleId;
    resolvedCourseId = lecture.module.courseId;
  }

  // Check full course enrollment first (higher priority)
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId: resolvedCourseId } },
  });
  if (enrollment) return { type: "course", moduleId, courseId: resolvedCourseId };

  // Check standalone module access
  const moduleAccess = await prisma.moduleAccess.findUnique({
    where: { studentId_moduleId: { studentId, moduleId } },
  });
  if (moduleAccess) return { type: "module", moduleId, courseId: resolvedCourseId };

  return { type: "none" };
}

/**
 * Check if a student has any form of access to a course
 * (full enrollment or at least one module purchase).
 */
export async function checkCourseAccess(
  studentId: string,
  courseId: string
): Promise<{ type: "full" | "partial" | "none"; moduleIds?: string[] }> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });
  if (enrollment) return { type: "full" };

  const moduleAccess = await prisma.moduleAccess.findMany({
    where: { studentId, courseId },
    select: { moduleId: true },
  });
  if (moduleAccess.length > 0) {
    return {
      type: "partial",
      moduleIds: moduleAccess.map((ma) => ma.moduleId),
    };
  }

  return { type: "none" };
}

/**
 * Calculate the upgrade price from individual module purchases to the full course.
 * Returns the remaining amount in ZAR cents.
 */
export async function calculateUpgradePrice(
  studentId: string,
  courseId: string
): Promise<{ upgradePrice: number; fullPrice: number; totalPaid: number }> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { price: true },
  });

  if (!course) return { upgradePrice: 0, fullPrice: 0, totalPaid: 0 };

  const moduleAccess = await prisma.moduleAccess.findMany({
    where: { studentId, courseId },
    select: { pricePaid: true },
  });

  const totalPaid = moduleAccess.reduce((sum, ma) => sum + ma.pricePaid, 0);
  const upgradePrice = Math.max(0, course.price - totalPaid);

  return { upgradePrice, fullPrice: course.price, totalPaid };
}

/**
 * Filter lectures by context based on the student's access type.
 * - Course enrollment: show "both" + "course_only" lectures
 * - Module access: show "both" + "standalone_only" lectures
 */
export function filterLecturesByContext<
  T extends { context: string }
>(lectures: T[], accessType: "course" | "module"): T[] {
  if (accessType === "course") {
    return lectures.filter((l) => l.context !== "standalone_only");
  }
  return lectures.filter((l) => l.context !== "course_only");
}
