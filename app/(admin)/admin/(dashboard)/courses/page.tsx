export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { SortableCourseList } from "./sortable-course-list";
import { PageHeader } from "@/components/admin/page-header";

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
      <PageHeader
        title="Courses"
        description="Manage your course catalog."
        action={
          <Button asChild>
            <Link href="/admin/courses/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Course
            </Link>
          </Button>
        }
      />

      <div className="rounded-lg border bg-card p-4">
        <SortableCourseList courses={courses} />
      </div>
    </div>
  );
}
