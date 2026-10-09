export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { LectureForm } from "@/components/admin/lecture-form";
import { updateLecture } from "../actions";
import { PageHeader } from "@/components/admin/page-header";

export default async function EditLecturePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string; lectureId: string }>;
}) {
  const { id, moduleId, lectureId } = await params;
  const [mod, lecture] = await Promise.all([
    prisma.module.findUnique({
      where: { id: moduleId },
      include: { course: { select: { title: true, slug: true } } },
    }),
    prisma.lecture.findUnique({ where: { id: lectureId } }),
  ]);

  if (!mod || !lecture) notFound();

  // slugify module title for Bunny storage path
  const moduleSlug = (mod.standaloneSlug || mod.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateLecture(
      id,
      moduleId,
      lectureId,
      formData
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{
          href: `/admin/courses/${id}/modules/${moduleId}/lectures`,
          to: `${mod.course.title} — ${mod.title} — Lectures`,
        }}
        title="Edit Lecture"
        description={lecture.title}
      />
      <LectureForm
        initialData={lecture}
        courseSlug={mod.course.slug}
        moduleSlug={moduleSlug}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
