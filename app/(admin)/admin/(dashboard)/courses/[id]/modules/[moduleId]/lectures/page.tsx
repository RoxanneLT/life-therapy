export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Video, ArrowLeft } from "lucide-react";
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
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/admin/courses/${id}/modules`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {mod.course.title} — Modules
          </Link>
          <h1 className="font-heading text-2xl font-bold">
            {mod.title} — Lectures
          </h1>
          <p className="text-sm text-muted-foreground">
            {mod.lectures.length} lecture{mod.lectures.length !== 1 && "s"}
            {totalMin > 0 && ` · ${totalMin >= 60 ? `${Math.floor(totalMin / 60)}h ${totalMin % 60}m` : `${totalMin}m`} total`}
          </p>
        </div>
        <Button asChild>
          <Link href={`${base}/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lecture
          </Link>
        </Button>
      </div>

      {mod.lectures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Video className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="font-heading text-lg font-semibold">
              No lectures yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first lecture to this module.
            </p>
          </CardContent>
        </Card>
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
