"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ImageUpload } from "@/components/admin/image-upload";
import { slugify } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface CourseOption {
  id: string;
  title: string;
}

interface PackageFormProps {
  courses: CourseOption[];
  initialData?: {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    imageUrl?: string | null;
    priceCents: number;
    credits: number;
    documentUrl?: string | null;
    isPublished: boolean;
    sortOrder: number;
    courseIds: string[];
  };
  onSubmit: (formData: FormData) => Promise<void>;
}

export function PackageForm({ courses, initialData, onSubmit }: PackageFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(
    initialData?.courseIds || []
  );
  const [submitting, setSubmitting] = useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!initialData) {
      setSlug(slugify(value));
    }
  }

  function toggleCourse(courseId: string) {
    setSelectedCourseIds((prev) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("slug", slug);
    formData.set("imageUrl", imageUrl);
    formData.set("isPublished", String(isPublished));
    // Remove any existing courseIds then append selected ones
    formData.delete("courseIds");
    for (const id of selectedCourseIds) {
      formData.append("courseIds", id);
    }
    await onSubmit(formData);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initialData?.description || ""}
          placeholder="What does this package include?"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Package Image</Label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="priceCents">Price (ZAR cents)</Label>
          <Input
            id="priceCents"
            name="priceCents"
            type="number"
            defaultValue={initialData?.priceCents ?? 0}
            min={0}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credits">Session Credits</Label>
          <Input
            id="credits"
            name="credits"
            type="number"
            defaultValue={initialData?.credits ?? 0}
            min={0}
          />
          <p className="text-xs text-muted-foreground">0 = no credits included</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={initialData?.sortOrder ?? 0}
            min={0}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="documentUrl">Document URL (optional)</Label>
        <Input
          id="documentUrl"
          name="documentUrl"
          defaultValue={initialData?.documentUrl || ""}
          placeholder="https://... link to downloadable document"
        />
        <p className="text-xs text-muted-foreground">
          For digital document packages — a file that gets sent on purchase.
        </p>
      </div>

      {courses.length > 0 && (
        <div className="space-y-3">
          <Label>Included Courses</Label>
          <div className="rounded-md border p-4 space-y-2">
            {courses.map((course) => (
              <label
                key={course.id}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Checkbox
                  checked={selectedCourseIds.includes(course.id)}
                  onCheckedChange={() => toggleCourse(course.id)}
                />
                <span className="text-sm">{course.title}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Select courses to include in this package. Students get enrolled in all selected courses on purchase.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={isPublished} onCheckedChange={setIsPublished} />
        <Label>Published</Label>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData ? "Save Changes" : "Create Package"}
      </Button>
    </form>
  );
}
