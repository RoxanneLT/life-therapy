export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ModuleForm } from "@/components/admin/module-form";
import { createModule } from "../actions";
import { ArrowLeft } from "lucide-react";

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
      <div>
        <Link
          href={`/admin/courses/${course.id}/modules`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {course.title} — Modules
        </Link>
        <h1 className="font-heading text-2xl font-bold">New Module</h1>
      </div>
      <ModuleForm onSubmit={handleCreate} />
    </div>
  );
}
