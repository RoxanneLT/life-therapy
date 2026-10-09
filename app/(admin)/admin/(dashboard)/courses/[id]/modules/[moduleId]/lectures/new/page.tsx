export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LectureForm } from "@/components/admin/lecture-form";
import { createLecture } from "../actions";
import { PageHeader } from "@/components/admin/page-header";

export default async function NewLecturePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { title: true, slug: true } } },
  });

  if (!mod) notFound();

  const moduleSlug = (mod.standaloneSlug || mod.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  async function handleCreate(formData: FormData) {
    "use server";
    await createLecture(id, moduleId, formData);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{
          href: `/admin/courses/${id}/modules/${moduleId}/lectures`,
          to: `${mod.course.title} — ${mod.title} — Lectures`,
        }}
        title="New Lecture"
      />
      <LectureForm
        courseSlug={mod.course.slug}
        moduleSlug={moduleSlug}
        onSubmit={handleCreate}
      />
    </div>
  );
}
