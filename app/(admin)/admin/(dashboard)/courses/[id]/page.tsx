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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    await deleteCourse(id);
    redirect("/admin/courses");
  }

  return (
    <div className="space-y-6">
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
