export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ModuleForm } from "@/components/admin/module-form";
import { updateModule } from "../actions";
import { PageHeader } from "@/components/admin/page-header";

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  const [course, mod] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      select: { id: true, title: true },
    }),
    prisma.module.findUnique({ where: { id: moduleId } }),
  ]);

  if (!course || !mod) notFound();

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateModule(id, moduleId, formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: `/admin/courses/${course.id}/modules`, to: `${course.title} — Modules` }}
        title="Edit Module"
        description={mod.title}
      />
      <ModuleForm initialData={mod} onSubmit={handleUpdate} />
    </div>
  );
}
