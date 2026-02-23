"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/admin/image-upload";
import { slugify } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { SeoFields } from "@/components/admin/seo-fields";

const CATEGORIES = [
  { value: "self_esteem", label: "Self-Esteem & Confidence" },
  { value: "mental_wellness", label: "Mental Wellness" },
  { value: "relationships", label: "Relationships" },
  { value: "specialised", label: "Specialised" },
];

const LEVELS = ["Beginner", "Intermediate", "Advanced"];

interface CourseFormProps {
  initialData?: {
    id: string;
    title: string;
    slug: string;
    subtitle?: string | null;
    shortDescription?: string | null;
    description?: string | null;
    imageUrl?: string | null;
    price: number;
    priceUsd?: number | null;
    priceEur?: number | null;
    priceGbp?: number | null;
    category?: string | null;
    modulesCount: number;
    hours?: string | null;
    level?: string | null;
    isPublished: boolean;
    isFeatured: boolean;
    sortOrder: number;
    previewVideoUrl?: string | null;
    facilitatorScript?: string | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
  onSubmit: (formData: FormData) => Promise<void>;
}

export function CourseForm({ initialData, onSubmit }: CourseFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [category, setCategory] = useState(initialData?.category || "");
  const [level, setLevel] = useState(initialData?.level || "");
  const [isPublished, setIsPublished] = useState(
    initialData?.isPublished ?? false
  );
  const [isFeatured, setIsFeatured] = useState(
    initialData?.isFeatured ?? false
  );
  const [submitting, setSubmitting] = useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!initialData) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("slug", slug);
    formData.set("imageUrl", imageUrl);
    formData.set("category", category);
    formData.set("level", level);
    formData.set("isPublished", String(isPublished));
    formData.set("isFeatured", String(isFeatured));
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
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input
          id="subtitle"
          name="subtitle"
          defaultValue={initialData?.subtitle || ""}
          placeholder="One-line description"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="shortDescription">Short Description</Label>
        <Textarea
          id="shortDescription"
          name="shortDescription"
          defaultValue={initialData?.shortDescription || ""}
          placeholder="Brief description for course cards"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Full Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initialData?.description || ""}
          placeholder="Detailed course description..."
          rows={5}
        />
      </div>

      <div className="space-y-2">
        <Label>Course Image</Label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="price">Price (ZAR cents)</Label>
          <Input
            id="price"
            name="price"
            type="number"
            defaultValue={initialData?.price ?? 38900}
            min={0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceUsd">Price (USD cents)</Label>
          <Input
            id="priceUsd"
            name="priceUsd"
            type="number"
            defaultValue={initialData?.priceUsd ?? ""}
            min={0}
            placeholder="e.g. 2499 = $24.99"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceEur">Price (EUR cents)</Label>
          <Input
            id="priceEur"
            name="priceEur"
            type="number"
            defaultValue={initialData?.priceEur ?? ""}
            min={0}
            placeholder="e.g. 2299 = €22.99"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceGbp">Price (GBP cents)</Label>
          <Input
            id="priceGbp"
            name="priceGbp"
            type="number"
            defaultValue={initialData?.priceGbp ?? ""}
            min={0}
            placeholder="e.g. 1999 = £19.99"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Level</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="modulesCount">Modules</Label>
          <Input
            id="modulesCount"
            name="modulesCount"
            type="number"
            defaultValue={initialData?.modulesCount ?? 0}
            min={0}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hours">Duration</Label>
          <Input
            id="hours"
            name="hours"
            defaultValue={initialData?.hours || ""}
            placeholder="~6 Hours"
          />
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

      {/* Preview Video & Facilitator Script */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-medium">Preview Video (Sofia Hart)</h3>
        <div className="space-y-2">
          <Label htmlFor="previewVideoUrl">Preview Video URL</Label>
          <Input
            id="previewVideoUrl"
            name="previewVideoUrl"
            defaultValue={initialData?.previewVideoUrl || ""}
            placeholder="https://www.youtube.com/watch?v=... or Vimeo URL"
          />
          <p className="text-xs text-muted-foreground">
            Short intro video shown on the course page before purchase
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="facilitatorScript">Facilitator Script</Label>
          <Textarea
            id="facilitatorScript"
            name="facilitatorScript"
            defaultValue={initialData?.facilitatorScript || ""}
            placeholder="Script for Sofia Hart to introduce this course..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Not shown publicly — used to produce the preview video
          </p>
        </div>
      </div>

      <SeoFields
        metaTitle={initialData?.metaTitle || ""}
        metaDescription={initialData?.metaDescription || ""}
      />

      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          <Label>Published</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
          <Label>Featured</Label>
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData ? "Save Changes" : "Create Course"}
      </Button>
    </form>
  );
}
