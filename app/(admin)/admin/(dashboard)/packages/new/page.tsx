export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PackageForm } from "@/components/admin/package-form";
import { createPackage } from "../actions";

export default async function NewPackagePage() {
  await requireRole("super_admin");

  const courses = await prisma.course.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Create Package</h1>
        <p className="text-sm text-muted-foreground">
          Add a new course bundle, credit pack, or hybrid package.
        </p>
      </div>
      <PackageForm courses={courses} onSubmit={createPackage} />
    </div>
  );
}
