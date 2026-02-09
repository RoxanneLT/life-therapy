export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { LectureForm } from "@/components/admin/lecture-form";
import { createLecture } from "../actions";
import { ArrowLeft } from "lucide-react";

export default async function NewLecturePage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { course: { select: { title: true } } },
  });

  if (!mod) notFound();

  async function handleCreate(formData: FormData) {
    "use server";
    await createLecture(id, moduleId, formData);
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
        <h1 className="font-heading text-2xl font-bold">New Lecture</h1>
      </div>
      <LectureForm onSubmit={handleCreate} />
    </div>
  );
}
