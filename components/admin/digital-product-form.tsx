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
import { FileUpload } from "@/components/admin/file-upload";
import { slugify } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { SeoFields } from "@/components/admin/seo-fields";
import { PppPriceFields } from "@/components/admin/ppp-price-fields";

interface DigitalProductFormProps {
  initialData?: {
    id: string;
    title: string;
    slug: string;
    description?: string | null;
    imageUrl?: string | null;
    fileUrl: string;
    fileName?: string | null;
    fileSizeBytes?: number | null;
    priceCents: number;
    priceCentsUsd?: number | null;
    priceCentsEur?: number | null;
    priceCentsGbp?: number | null;
    category?: string | null;
    isPublished: boolean;
    sortOrder: number;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
  categories?: string[];
  onSubmit: (formData: FormData) => Promise<void>;
}

export function DigitalProductForm({ initialData, categories = [], onSubmit }: DigitalProductFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [fileUrl, setFileUrl] = useState(initialData?.fileUrl || "");
  const [fileName, setFileName] = useState(initialData?.fileName || "");
  const [fileSizeBytes, setFileSizeBytes] = useState(initialData?.fileSizeBytes ?? 0);
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

  function handleFileChange(
    data: { path: string; fileName: string; fileSizeBytes: number } | null
  ) {
    if (data) {
      setFileUrl(data.path);
      setFileName(data.fileName);
      setFileSizeBytes(data.fileSizeBytes);
    } else {
      setFileUrl("");
      setFileName("");
      setFileSizeBytes(0);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("slug", slug);
    formData.set("imageUrl", imageUrl);
    formData.set("fileUrl", fileUrl);
    formData.set("fileName", fileName);
    formData.set("fileSizeBytes", String(fileSizeBytes));
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
          placeholder="Describe what this product contains..."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Product Image</Label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </div>

      <div className="space-y-2">
        <Label>Product File</Label>
        <FileUpload
          value={fileUrl}
          fileName={fileName}
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">
          The downloadable file students receive after purchase. Stored securely — students access via signed URLs.
        </p>
      </div>

      <PppPriceFields
        names={{ zar: "priceCents", usd: "priceCentsUsd", eur: "priceCentsEur", gbp: "priceCentsGbp" }}
        defaultZar={initialData?.priceCents ?? 0}
        defaultUsd={initialData?.priceCentsUsd}
        defaultEur={initialData?.priceCentsEur}
        defaultGbp={initialData?.priceCentsGbp}
      />

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

      <Button type="submit" disabled={submitting || !fileUrl}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData ? "Save Changes" : "Create Product"}
      </Button>
    </form>
  );
}
