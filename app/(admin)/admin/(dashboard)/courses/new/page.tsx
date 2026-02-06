"use client";

import { CourseForm } from "@/components/admin/course-form";
import { createCourse } from "../actions";

export default function NewCoursePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Add Course</h1>
        <p className="text-sm text-muted-foreground">
          Create a new course in the catalog.
        </p>
      </div>
      <CourseForm onSubmit={createCourse} />
    </div>
  );
}
