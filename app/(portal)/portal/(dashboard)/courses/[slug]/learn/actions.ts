"use server";

import { getAuthenticatedStudent } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { checkLectureAccess } from "@/lib/access";
import { recalculateProgress } from "@/lib/progress";
import { revalidatePath } from "next/cache";

/**
 * Mark a lecture as complete and recalculate progress.
 * Supports both full course enrollment and module-only access.
 */
export async function markLectureCompleteAction(
  lectureId: string,
  courseSlug: string
) {
  const { student } = await getAuthenticatedStudent();

  // Get lecture's module and course
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    include: { module: { select: { id: true, courseId: true } } },
  });
  if (!lecture) return { error: "Lecture not found" };

  // Verify access (enrollment OR module access)
  const access = await checkLectureAccess(
    student.id,
    lecture.module.id,
    lecture.module.courseId
  );
  if (access.type === "none") return { error: "No access" };

  // Upsert lecture progress
  await prisma.lectureProgress.upsert({
    where: {
      studentId_lectureId: { studentId: student.id, lectureId },
    },
    create: {
      studentId: student.id,
      lectureId,
      completed: true,
      completedAt: new Date(),
    },
    update: {
      completed: true,
      completedAt: new Date(),
    },
  });

  // Recalculate progress only for full course enrollments
  let progress = { progressPercent: 0, completed: false };
  if (access.type === "course") {
    progress = await recalculateProgress(student.id, lecture.module.courseId);
  }

  revalidatePath(`/portal/courses/${courseSlug}`);
  revalidatePath(`/portal/courses/${courseSlug}/learn`);
  revalidatePath("/portal");
  revalidatePath("/portal/courses");

  return { success: true, ...progress };
}

/**
 * Save video playback position (debounced from client).
 */
export async function saveVideoPositionAction(
  lectureId: string,
  position: number
) {
  const { student } = await getAuthenticatedStudent();

  await prisma.lectureProgress.upsert({
    where: {
      studentId_lectureId: { studentId: student.id, lectureId },
    },
    create: {
      studentId: student.id,
      lectureId,
      videoPosition: Math.floor(position),
    },
    update: {
      videoPosition: Math.floor(position),
    },
  });

  return { success: true };
}

/**
 * Submit a quiz attempt.
 */
export async function submitQuizAction(
  quizId: string,
  courseSlug: string,
  answers: Record<string, string>
) {
  const { student } = await getAuthenticatedStudent();

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      module: { select: { id: true, courseId: true } },
    },
  });
  if (!quiz) return { error: "Quiz not found" };

  // Verify access (enrollment OR module access)
  const access = await checkLectureAccess(
    student.id,
    quiz.module.id,
    quiz.module.courseId
  );
  if (access.type === "none") return { error: "No access" };

  // Grade
  let correct = 0;
  const feedback: {
    questionId: string;
    correct: boolean;
    explanation?: string;
  }[] = [];

  for (const question of quiz.questions) {
    const studentAnswer = answers[question.id] || "";

    if (question.questionType === "reflection") {
      correct++;
      feedback.push({
        questionId: question.id,
        correct: true,
        explanation: question.explanation || undefined,
      });
    } else {
      const options = question.options as
        | { label: string; value: string; correct?: boolean }[]
        | null;
      const correctOption = options?.find((o) => o.correct);
      const isCorrect = correctOption?.value === studentAnswer;
      if (isCorrect) correct++;
      feedback.push({
        questionId: question.id,
        correct: isCorrect,
        explanation: question.explanation || undefined,
      });
    }
  }

  const totalQuestions = quiz.questions.length;
  const score =
    totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
  const passed = score >= quiz.passingScore;

  // Save attempt
  await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId: student.id,
      score,
      passed,
      answers,
    },
  });

  revalidatePath(`/portal/courses/${courseSlug}`);

  return { score, passed, feedback };
}

/**
 * Save or update a student note for a lecture.
 */
export async function saveNoteAction(lectureId: string, content: string) {
  const { student } = await getAuthenticatedStudent();

  const existing = await prisma.studentNote.findFirst({
    where: { studentId: student.id, lectureId },
  });

  if (existing) {
    await prisma.studentNote.update({
      where: { id: existing.id },
      data: { content },
    });
  } else {
    await prisma.studentNote.create({
      data: { studentId: student.id, lectureId, content },
    });
  }

  return { success: true };
}
