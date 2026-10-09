export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ModuleForm } from "@/components/admin/module-form";
import { createModule } from "../actions";
import { PageHeader } from "@/components/admin/page-header";
import { requireAccess } from "@/lib/auth";

export default async function NewModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccess("/admin/courses");
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
        breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: course.title, href: `/admin/courses/${id}` }, { label: "Modules", href: `/admin/courses/${id}/modules` }, { label: "New module" }]}
        title="New Module"
      />
      <ModuleForm onSubmit={handleCreate} />
    </div>
  );
}
