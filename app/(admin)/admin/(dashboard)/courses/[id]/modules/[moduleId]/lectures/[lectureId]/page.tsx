export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LectureForm } from "@/components/admin/lecture-form";
import { updateLecture } from "../actions";
import { ArrowLeft } from "lucide-react";

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
      <div>
        <Link
          href={`/admin/courses/${id}/modules/${moduleId}/lectures`}
          className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          {mod.course.title} — {mod.title} — Lectures
        </Link>
        <h1 className="font-heading text-2xl font-bold">Edit Lecture</h1>
        <p className="text-sm text-muted-foreground">{lecture.title}</p>
      </div>
      <LectureForm
        initialData={lecture}
        courseSlug={mod.course.slug}
        moduleSlug={moduleSlug}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
