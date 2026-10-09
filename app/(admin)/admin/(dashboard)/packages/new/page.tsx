export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { requireAccess } from "@/lib/auth";
import { PackageForm } from "@/components/admin/package-form";
import { createPackage } from "../actions";

export default async function NewPackagePage() {
  await requireAccess("/admin/packages");

  const [categoryRows, courses, modules, digitalProducts] = await Promise.all([
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Package"
        description="Add a new pick-your-own bundle with courses, digital products & session credits."
      />
      <PackageForm
        categories={categoryRows.map((c) => c.category!)}
        availableCourses={courses}
        availableModules={modules.map((m) => ({ id: m.id, title: m.standaloneTitle || m.title }))}
        availableDigitalProducts={digitalProducts}
        onSubmit={createPackage}
      />
    </div>
  );
}
