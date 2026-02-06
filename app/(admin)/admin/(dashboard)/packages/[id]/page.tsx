export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PackageForm } from "@/components/admin/package-form";
import { updatePackage, deletePackage } from "../actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;

  const [pkg, courses] = await Promise.all([
    prisma.hybridPackage.findUnique({
      where: { id },
      include: {
        courses: {
          orderBy: { sortOrder: "asc" },
          select: { courseId: true },
        },
      },
    }),
    prisma.course.findMany({
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  if (!pkg) notFound();

  const initialData = {
    id: pkg.id,
    title: pkg.title,
    slug: pkg.slug,
    description: pkg.description,
    imageUrl: pkg.imageUrl,
    priceCents: pkg.priceCents,
    credits: pkg.credits,
    documentUrl: pkg.documentUrl,
    isPublished: pkg.isPublished,
    sortOrder: pkg.sortOrder,
    courseIds: pkg.courses.map((c) => c.courseId),
  };

  async function handleSubmit(formData: FormData) {
    "use server";
    await updatePackage(id, formData);
  }

  async function handleDelete() {
    "use server";
    await deletePackage(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/packages">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-bold">Edit Package</h1>
          <p className="text-sm text-muted-foreground">{pkg.title}</p>
        </div>
        <form action={handleDelete}>
          <Button variant="destructive" size="sm" type="submit">
            Delete
          </Button>
        </form>
      </div>
      <PackageForm
        courses={courses}
        initialData={initialData}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
