"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/admin/image-upload";
import { slugify } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { SeoFields } from "@/components/admin/seo-fields";

interface PackageFormProps {
  initialData?: {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    imageUrl?: string | null;
    priceCents: number;
    priceCentsUsd?: number | null;
    priceCentsEur?: number | null;
    priceCentsGbp?: number | null;
    credits: number;
    courseSlots: number;
    digitalProductSlots: number;
    category?: string | null;
    isPublished: boolean;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
  categories?: string[];
  onSubmit: (formData: FormData) => Promise<void>;
}

export function PackageForm({ initialData, categories = [], onSubmit }: PackageFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? false);
  const [category, setCategory] = useState(initialData?.category || "");
  const [addingCategory, setAddingCategory] = useState(false);
  const [localCategories, setLocalCategories] = useState<string[]>(categories);
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
    formData.set("isPublished", String(isPublished));
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
          placeholder="Describe what this package offers..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Package Image</Label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Label htmlFor="priceCentsUsd">Price (USD cents)</Label>
          <Input
            id="priceCentsUsd"
            name="priceCentsUsd"
            type="number"
            defaultValue={initialData?.priceCentsUsd ?? ""}
            min={0}
            placeholder="e.g. 4999 = $49.99"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceCentsEur">Price (EUR cents)</Label>
          <Input
            id="priceCentsEur"
            name="priceCentsEur"
            type="number"
            defaultValue={initialData?.priceCentsEur ?? ""}
            min={0}
            placeholder="e.g. 4499 = €44.99"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="priceCentsGbp">Price (GBP cents)</Label>
          <Input
            id="priceCentsGbp"
            name="priceCentsGbp"
            type="number"
            defaultValue={initialData?.priceCentsGbp ?? ""}
            min={0}
            placeholder="e.g. 3999 = £39.99"
          />
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 p-4">
        <h3 className="mb-3 text-sm font-semibold">Bundle Contents</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Define how many items the customer can pick. They choose from the published catalog at purchase time.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="courseSlots">Course Slots</Label>
            <Input
              id="courseSlots"
              name="courseSlots"
              type="number"
              defaultValue={initialData?.courseSlots ?? 0}
              min={0}
            />
            <p className="text-xs text-muted-foreground">Full courses the customer picks</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="digitalProductSlots">Digital Product Slots</Label>
            <Input
              id="digitalProductSlots"
              name="digitalProductSlots"
              type="number"
              defaultValue={initialData?.digitalProductSlots ?? 0}
              min={0}
            />
            <p className="text-xs text-muted-foreground">Digital products the customer picks</p>
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
            <p className="text-xs text-muted-foreground">Auto-granted on purchase</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        {addingCategory ? (
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="New category name"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setCategory(initialData?.category || "");
                  setAddingCategory(false);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                const trimmed = category.trim();
                if (trimmed && !localCategories.includes(trimmed)) {
                  setLocalCategories((prev) => [...prev, trimmed].sort((a, b) => a.localeCompare(b)));
                }
                setAddingCategory(false);
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <Select
            value={category}
            onValueChange={(val) => {
              if (val === "__new__") {
                setCategory("");
                setAddingCategory(true);
              } else {
                setCategory(val);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {localCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
              <SelectItem value="__new__">+ Add new category</SelectItem>
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">Optional — used for filtering on the storefront</p>
      </div>

      <SeoFields
        metaTitle={initialData?.metaTitle || ""}
        metaDescription={initialData?.metaDescription || ""}
      />

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
