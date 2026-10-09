export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/admin/empty-state";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Plus, BookOpen } from "lucide-react";
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
      <PageHeader
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.title, href: `/admin/courses/${id}` }, { label: "Modules" }]}
        title="Modules"
        description={`${course.modules.length} module${course.modules.length !== 1 ? "s" : ""}`}
        action={
          <Button asChild>
            <Link href={`/admin/courses/${course.id}/modules/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Module
            </Link>
          </Button>
        }
      />

      {course.modules.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          message="No modules yet."
          description="Add your first module to start building course content."
        />
      ) : (
        <SortableModuleList modules={modules} courseId={course.id} />
      )}
    </div>
  );
}
