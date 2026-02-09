import { prisma } from "./prisma";
import crypto from "crypto";
import { sendEmail } from "./email";
import { renderEmail } from "./email-render";
import { getBaseUrl } from "./get-region";

/**
 * Recalculates and updates the progress percentage for an enrollment.
 * Progress = completedLectures / totalLectures * 100
 * When 100%, auto-generates a certificate.
 */
export async function recalculateProgress(
  studentId: string,
  courseId: string
): Promise<{ progressPercent: number; completed: boolean }> {
  // Get all lectures for the course
  const modules = await prisma.module.findMany({
    where: { courseId },
    include: { lectures: { select: { id: true } } },
  });

  const allLectureIds = modules.flatMap((m) =>
    m.lectures.map((l) => l.id)
  );
  const totalLectures = allLectureIds.length;

  if (totalLectures === 0) {
    return { progressPercent: 0, completed: false };
  }

  // Count completed lectures
  const completedCount = await prisma.lectureProgress.count({
    where: {
      studentId,
      lectureId: { in: allLectureIds },
      completed: true,
    },
  });

  const progressPercent = Math.round((completedCount / totalLectures) * 100);
  const completed = progressPercent === 100;

  // Update enrollment
  await prisma.enrollment.update({
    where: { studentId_courseId: { studentId, courseId } },
    data: {
      progressPercent,
      completedAt: completed ? new Date() : null,
    },
  });

  // Auto-generate certificate at 100% and send congratulations email
  if (completed) {
    const certNumber = await generateCertificate(studentId, courseId);

    // Look up student + course for the email
    const [student, course] = await Promise.all([
      prisma.student.findUnique({ where: { id: studentId }, select: { email: true, firstName: true } }),
      prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    ]);

    if (student && course) {
      let baseUrl: string;
      try { baseUrl = await getBaseUrl(); } catch { baseUrl = "https://life-therapy.co.za"; }
      renderEmail("course_completed", {
        firstName: student.firstName,
        courseTitle: course.title,
        certificateNumber: certNumber,
        portalUrl: `${baseUrl}/portal/certificates`,
      }, baseUrl).then(({ subject, html }) =>
        sendEmail({ to: student.email, subject, html })
      ).catch((err) =>
        console.error("Failed to send course completion email:", err)
      );
    }
  }

  return { progressPercent, completed };
}

/**
 * Generates a certificate for a student-course pair if one doesn't exist.
 */
export async function generateCertificate(
  studentId: string,
  courseId: string
): Promise<string> {
  const existing = await prisma.certificate.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
  });

  if (existing) {
    return existing.certificateNumber;
  }

  const certificateNumber = `LT-CERT-${Date.now()}-${crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;

  await prisma.certificate.create({
    data: {
      studentId,
      courseId,
      certificateNumber,
    },
  });

  return certificateNumber;
}
