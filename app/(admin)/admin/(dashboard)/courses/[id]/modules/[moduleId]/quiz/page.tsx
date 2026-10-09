export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { QuizEditor } from "@/components/admin/quiz-editor";
import { createOrUpdateQuiz, deleteQuiz, saveQuestion, deleteQuestion } from "./actions";
import { PageHeader } from "@/components/admin/page-header";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
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
    await createOrUpdateQuiz(id, moduleId, formData);
  }

  async function handleDeleteQuiz() {
    "use server";
    await deleteQuiz(id, moduleId);
  }

  async function handleSaveQuestion(
    quizId: string,
    questionId: string | null,
    formData: FormData
  ) {
    "use server";
    await saveQuestion(id, moduleId, quizId, questionId, formData);
  }

  async function handleDeleteQuestion(questionId: string) {
    "use server";
    await deleteQuestion(id, moduleId, questionId);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: mod.course.title, href: `/admin/courses/${id}` }, { label: "Modules", href: `/admin/courses/${id}/modules` }, { label: mod.title, href: `/admin/courses/${id}/modules/${moduleId}` }, { label: "Quiz" }]}
        title={`${mod.title} — Quiz`}
      />
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
