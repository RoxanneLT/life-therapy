export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { CourseForm } from "@/components/admin/course-form";
import { updateCourse, deleteCourse } from "../actions";
import { Button } from "@/components/ui/button";
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
import { Trash2, Layers } from "lucide-react";

import Link from "next/link";

export default async function EditCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deleteError?: string }>;
}) {
  const { id } = await params;
  const { deleteError } = await searchParams;
  const course = await prisma.course.findUnique({
    where: { id },
  });

  if (!course) notFound();

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateCourse(id, formData);
  }

  async function handleDelete() {
    "use server";
    // Only leave the page if the course actually went. A refusal (real enrolments or
    // certificates attached) comes back as a message rather than redirecting to a
    // list where the course is still sitting.
    const result = await deleteCourse(id);
    if (!result.success) {
      redirect(`/admin/courses/${id}?deleteError=${encodeURIComponent(result.error ?? "Could not delete this course.")}`);
    }
    redirect("/admin/courses");
  }

  return (
    <div className="space-y-6">
      {deleteError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {deleteError}
        </p>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Edit Course</h1>
          <p className="text-sm text-muted-foreground">{course.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/courses/${id}/modules`}>
              <Layers className="mr-2 h-4 w-4" />
              Manage Modules
            </Link>
          </Button>
          <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete course?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &ldquo;{course.title}&rdquo;.
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
        </div>
      </div>
      <CourseForm initialData={course} onSubmit={handleUpdate} />
    </div>
  );
}
