export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, BookOpen, ArrowLeft } from "lucide-react";
import { SortableModuleList } from "./sortable-module-list";

export default async function ModulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { sortOrder: "asc" },
        include: {
          lectures: { select: { id: true } },
          quiz: { select: { id: true } },
        },
      },
    },
  });

  if (!course) notFound();

  const modules = course.modules.map((mod) => ({
    id: mod.id,
    title: mod.title,
    lectureCount: mod.lectures.length,
    hasQuiz: !!mod.quiz,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/admin/courses/${course.id}`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {course.title}
          </Link>
          <h1 className="font-heading text-2xl font-bold">Modules</h1>
          <p className="text-sm text-muted-foreground">
            {course.modules.length} module{course.modules.length !== 1 && "s"}
          </p>
        </div>
        <Button asChild>
          <Link href={`/admin/courses/${course.id}/modules/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Add Module
          </Link>
        </Button>
      </div>

      {course.modules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="font-heading text-lg font-semibold">
              No modules yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first module to start building course content.
            </p>
          </CardContent>
        </Card>
      ) : (
        <SortableModuleList modules={modules} courseId={course.id} />
      )}
    </div>
  );
}
