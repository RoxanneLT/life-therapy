export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ModuleForm } from "@/components/admin/module-form";
import { updateModule } from "../actions";
import { PageHeader } from "@/components/admin/page-header";
import { requireAccess } from "@/lib/auth";

export default async function EditModulePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  await requireAccess("/admin/courses");
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
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.title, href: `/admin/courses/${id}` }, { label: "Modules", href: `/admin/courses/${id}/modules` }, { label: mod.title }]}
        title="Edit Module"
        description={mod.title}
      />
      <ModuleForm initialData={mod} onSubmit={handleUpdate} />
    </div>
  );
}
