"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import type { QuestionType } from "@/lib/generated/prisma/client";

function basePath(courseId: string, moduleId: string) {
  return `/admin/courses/${courseId}/modules/${moduleId}/quiz`;
}

export async function createOrUpdateQuiz(
  courseId: string,
  moduleId: string,
  formData: FormData
) {
  await requireRole("super_admin", "editor");

  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const passingScore = parseInt(formData.get("passingScore") as string) || 70;

  await prisma.quiz.upsert({
    where: { moduleId },
    create: { moduleId, title, description, passingScore },
    update: { title, description, passingScore },
  });

  revalidatePath(basePath(courseId, moduleId));
}

export async function deleteQuiz(courseId: string, moduleId: string) {
  await requireRole("super_admin", "editor");

  const quiz = await prisma.quiz.findUnique({ where: { moduleId } });
  if (quiz) {
    await prisma.quiz.delete({ where: { id: quiz.id } });
  }

  revalidatePath(basePath(courseId, moduleId));
}

export async function saveQuestion(
  courseId: string,
  moduleId: string,
  quizId: string,
  questionId: string | null,
  formData: FormData
) {
  await requireRole("super_admin", "editor");

  const questionType = formData.get("questionType") as QuestionType;
  const questionText = formData.get("questionText") as string;
  const explanation = (formData.get("explanation") as string) || null;
  const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;
  const optionsRaw = formData.get("options") as string;
  const options = optionsRaw ? JSON.parse(optionsRaw) : null;

  if (questionId) {
    await prisma.quizQuestion.update({
      where: { id: questionId },
      data: { questionType, questionText, options, explanation, sortOrder },
    });
  } else {
    const count = await prisma.quizQuestion.count({ where: { quizId } });
    await prisma.quizQuestion.create({
      data: {
        quizId,
        questionType,
        questionText,
        options,
        explanation,
        sortOrder: sortOrder || count,
      },
    });
  }

  revalidatePath(basePath(courseId, moduleId));
}

export async function deleteQuestion(
  courseId: string,
  moduleId: string,
  questionId: string
) {
  await requireRole("super_admin", "editor");
  await prisma.quizQuestion.delete({ where: { id: questionId } });

  revalidatePath(basePath(courseId, moduleId));
}
