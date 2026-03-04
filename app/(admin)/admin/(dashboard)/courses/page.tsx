export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SortableCourseList } from "./sortable-course-list";

export default async function AdminCoursesPage() {
  const courses = await prisma.course.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      subtitle: true,
      category: true,
      price: true,
      modulesCount: true,
      isPublished: true,
      isFeatured: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Courses</h1>
          <p className="text-sm text-muted-foreground">
            Manage your course catalog.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Course
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <SortableCourseList courses={courses} />
      </div>
    </div>
  );
}
