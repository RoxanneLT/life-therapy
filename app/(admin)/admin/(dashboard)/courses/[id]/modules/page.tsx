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
import { Plus, Trash2, BookOpen, HelpCircle, ArrowLeft } from "lucide-react";
import { deleteModule } from "./actions";

export default async function ModulesPage({
  params,
}: {
  params: { id: string };
}) {
  const course = await prisma.course.findUnique({
    where: { id: params.id },
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
        <div className="space-y-3">
          {course.modules.map((mod, index) => (
            <Card key={mod.id}>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {index + 1}
                  </span>
                  <div>
                    <CardTitle className="text-base">{mod.title}</CardTitle>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {mod.lectures.length} lecture
                        {mod.lectures.length !== 1 && "s"}
                      </span>
                      {mod.quiz && (
                        <span className="flex items-center gap-1">
                          <HelpCircle className="h-3 w-3" />
                          Quiz
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/admin/courses/${course.id}/modules/${mod.id}/lectures`}
                    >
                      Lectures
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/admin/courses/${course.id}/modules/${mod.id}/quiz`}
                    >
                      Quiz
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link
                      href={`/admin/courses/${course.id}/modules/${mod.id}`}
                    >
                      Edit
                    </Link>
                  </Button>
                  <DeleteModuleButton
                    courseId={course.id}
                    moduleId={mod.id}
                    title={mod.title}
                  />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function DeleteModuleButton({
  courseId,
  moduleId,
  title,
}: {
  courseId: string;
  moduleId: string;
  title: string;
}) {
  async function handleDelete() {
    "use server";
    await deleteModule(courseId, moduleId);
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
          <AlertDialogTitle>Delete module?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &ldquo;{title}&rdquo; and all its
            lectures and quizzes.
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
