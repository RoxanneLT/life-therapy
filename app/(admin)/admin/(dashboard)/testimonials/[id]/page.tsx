export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
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
import { shortClientName } from "@/lib/client-display";

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

  const clients = await prisma.student.findMany({
    where: { clientStatus: { not: "potential" } },
    select: { firstName: true, lastName: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const clientOptions = clients.map((c) => ({
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    fillName: shortClientName(c.firstName, c.lastName),
  }));

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
    <TestimonialForm
      initialData={testimonial}
      onSubmit={handleUpdate}
      clients={clientOptions}
      headerTitle="Edit Testimonial"
      headerDescription={testimonial.name}
      backHref="/admin/testimonials"
      backLabel="Testimonials"
      headerActions={
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="sm">
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
      }
    />
  );
}
