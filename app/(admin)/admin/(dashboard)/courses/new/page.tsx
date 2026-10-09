"use client";

import { CourseForm } from "@/components/admin/course-form";
import { PageHeader } from "@/components/admin/page-header";
import { createCourse } from "../actions";

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: "New course" }]} title="Add Course" description="Create a new course in the catalog." />
      <CourseForm onSubmit={createCourse} />
    </div>
  );
}
