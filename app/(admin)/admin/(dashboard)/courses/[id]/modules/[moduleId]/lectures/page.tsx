export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/admin/empty-state";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Video } from "lucide-react";
import { SortableLectureList } from "./sortable-lecture-list";

export default async function LecturesPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: { select: { id: true, title: true } },
      lectures: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!mod) notFound();
  const base = `/admin/courses/${id}/modules/${moduleId}/lectures`;

  const totalSeconds = mod.lectures.reduce(
    (sum, l) => sum + (l.durationSeconds || 0),
    0
  );
  const totalMin = Math.round(totalSeconds / 60);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: mod.course.title, href: `/admin/courses/${id}` }, { label: "Modules", href: `/admin/courses/${id}/modules` }, { label: mod.title, href: `/admin/courses/${id}/modules/${moduleId}` }, { label: "Lectures" }]}
        title={`${mod.title} — Lectures`}
        description={`${mod.lectures.length} lecture${mod.lectures.length !== 1 ? "s" : ""}${totalMin > 0 ? ` · ${totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`} total` : ""}`}
        action={
          <Button asChild>
            <Link href={`${base}/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lecture
            </Link>
          </Button>
        }
      />

      {mod.lectures.length === 0 ? (
        <EmptyState icon={Video} message="No lectures yet." description="Add your first lecture to this module." />
      ) : (
        <SortableLectureList
          lectures={mod.lectures.map((l) => ({
            id: l.id,
            title: l.title,
            lectureType: l.lectureType,
            durationSeconds: l.durationSeconds,
            isPreview: l.isPreview,
          }))}
          courseId={id}
          moduleId={moduleId}
        />
      )}
    </div>
  );
}
