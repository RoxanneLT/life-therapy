export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Video, FileText, HelpCircle, ArrowLeft, Eye } from "lucide-react";
import { deleteLecture } from "./actions";
import { Badge } from "@/components/ui/badge";

const TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
};

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
        <div className="space-y-3">
          {mod.lectures.map((lec, index) => {
            const Icon = TYPE_ICONS[lec.lectureType] || FileText;
            return (
              <Card key={lec.id}>
                <CardHeader className="flex flex-row items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        {index + 1}. {lec.title}
                        {lec.isPreview && (
                          <Badge variant="secondary" className="text-xs">
                            <Eye className="mr-1 h-3 w-3" />
                            Preview
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {lec.lectureType}
                        {lec.durationSeconds
                          ? ` · ${Math.floor(lec.durationSeconds / 60)}m`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`${base}/${lec.id}`}>Edit</Link>
                    </Button>
                    <DeleteLectureButton
                      courseId={id}
                      moduleId={moduleId}
                      lectureId={lec.id}
                      title={lec.title}
                    />
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteLectureButton({
  courseId,
  moduleId,
  lectureId,
  title,
}: {
  courseId: string;
  moduleId: string;
  lectureId: string;
  title: string;
}) {
  async function handleDelete() {
    "use server";
    await deleteLecture(courseId, moduleId, lectureId);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete lecture?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{title}&rdquo;.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={handleDelete}>
            <AlertDialogAction type="submit">Delete</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
