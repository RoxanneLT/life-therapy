export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { PackageForm } from "@/components/admin/package-form";
import { updatePackage, deletePackage } from "../actions";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin");
  const { id } = await params;

  const [pkg, categoryRows, courses, modules, digitalProducts] = await Promise.all([
    prisma.hybridPackage.findUnique({ where: { id } }),
    prisma.hybridPackage.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
    prisma.course.findMany({
      where: { isPublished: true },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.module.findMany({
      where: { isStandalonePublished: true, course: { isPublished: true } },
      select: { id: true, standaloneTitle: true, title: true },
      orderBy: { standaloneTitle: "asc" },
    }),
    prisma.digitalProduct.findMany({
      where: { isPublished: true },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
  ]);

  if (!pkg) notFound();

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
      <PageHeader
        back={{ href: "/admin/packages", to: "Packages" }}
        title="Edit Package"
        description={pkg.title}
        action={
          <form action={handleDelete}>
            <Button variant="destructive" size="sm" type="submit">
              Delete
            </Button>
          </form>
        }
      />
      <PackageForm
        initialData={pkg}
        categories={categoryRows.map((c) => c.category!)}
        availableCourses={courses}
        availableModules={modules.map((m) => ({ id: m.id, title: m.standaloneTitle || m.title }))}
        availableDigitalProducts={digitalProducts}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
