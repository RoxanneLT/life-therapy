export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { TestimonialForm } from "@/components/admin/testimonial-form";
import { updateTestimonial, deleteTestimonial } from "../actions";
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
import { Trash2 } from "lucide-react";
import { redirect } from "next/navigation";

export default async function EditTestimonialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const testimonial = await prisma.testimonial.findUnique({
    where: { id },
  });

  if (!testimonial) notFound();

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateTestimonial(id, formData);
  }

  async function handleDelete() {
    "use server";
    await deleteTestimonial(id);
    redirect("/admin/testimonials");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Edit Testimonial</h1>
          <p className="text-sm text-muted-foreground">
            {testimonial.name}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete testimonial?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the testimonial from{" "}
                {testimonial.name}.
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
      <TestimonialForm initialData={testimonial} onSubmit={handleUpdate} />
    </div>
  );
}
