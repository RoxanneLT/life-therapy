export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ModuleForm } from "@/components/admin/module-form";
import { updateModule } from "../actions";
import { ArrowLeft } from "lucide-react";

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
      <div>
        <Link
          href={`/admin/courses/${course.id}/modules`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {course.title} — Modules
        </Link>
        <h1 className="font-heading text-2xl font-bold">Edit Module</h1>
        <p className="text-sm text-muted-foreground">{mod.title}</p>
      </div>
      <ModuleForm initialData={mod} onSubmit={handleUpdate} />
    </div>
  );
}
