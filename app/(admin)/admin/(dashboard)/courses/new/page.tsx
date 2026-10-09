import { CourseForm } from "@/components/admin/course-form";
import { PageHeader } from "@/components/admin/page-header";
import { createCourse } from "../actions";
import { requireAccess } from "@/lib/auth";

export default async function NewCoursePage() {
  await requireAccess("/admin/courses");
  return (
    <div className="space-y-6">
      <PageHeader breadcrumbs={[{ label: "Courses", href: "/admin/courses" }, { label: "New course" }]} title="Add Course" description="Create a new course in the catalog." />
      <CourseForm onSubmit={createCourse} />
    </div>
  );
}
