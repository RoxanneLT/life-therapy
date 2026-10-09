export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ModuleForm } from "@/components/admin/module-form";
import { createModule } from "../actions";
import { PageHeader } from "@/components/admin/page-header";

export default async function NewModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    select: { id: true, title: true },
  });

  if (!course) notFound();

  async function handleCreate(formData: FormData) {
    "use server";
    await createModule(id, formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/admin/courses/${course.id}/modules`, to: `${course.title} — Modules` }}
        title="New Module"
      />
      <ModuleForm onSubmit={handleCreate} />
    </div>
  );
}
