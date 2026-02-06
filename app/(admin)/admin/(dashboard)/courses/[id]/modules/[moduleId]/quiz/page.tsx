export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { QuizEditor } from "@/components/admin/quiz-editor";
import { createOrUpdateQuiz, deleteQuiz, saveQuestion, deleteQuestion } from "./actions";
import { ArrowLeft } from "lucide-react";

export default async function QuizPage({
  params,
}: {
  params: { id: string; moduleId: string };
}) {
  const mod = await prisma.module.findUnique({
    where: { id: params.moduleId },
    include: {
      course: { select: { title: true } },
      quiz: {
        include: {
          questions: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });

  if (!mod) notFound();

  async function handleSaveQuiz(formData: FormData) {
    "use server";
    await createOrUpdateQuiz(params.id, params.moduleId, formData);
  }

  async function handleDeleteQuiz() {
    "use server";
    await deleteQuiz(params.id, params.moduleId);
  }

  async function handleSaveQuestion(
    quizId: string,
    questionId: string | null,
    formData: FormData
  ) {
    "use server";
    await saveQuestion(params.id, params.moduleId, quizId, questionId, formData);
  }

  async function handleDeleteQuestion(questionId: string) {
    "use server";
    await deleteQuestion(params.id, params.moduleId, questionId);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/courses/${params.id}/modules`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {mod.course.title} — Modules
        </Link>
        <h1 className="font-heading text-2xl font-bold">
          {mod.title} — Quiz
        </h1>
      </div>
      <QuizEditor
        quiz={mod.quiz}
        onSaveQuiz={handleSaveQuiz}
        onDeleteQuiz={handleDeleteQuiz}
        onSaveQuestion={handleSaveQuestion}
        onDeleteQuestion={handleDeleteQuestion}
      />
    </div>
  );
}
