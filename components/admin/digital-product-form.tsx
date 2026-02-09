"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/admin/image-upload";
import { FileUpload } from "@/components/admin/file-upload";
import { slugify } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
  };
  onSubmit: (formData: FormData) => Promise<void>;
}

export function DigitalProductForm({ initialData, onSubmit }: DigitalProductFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [fileUrl, setFileUrl] = useState(initialData?.fileUrl || "");
  const [fileName, setFileName] = useState(initialData?.fileName || "");
  const [fileSizeBytes, setFileSizeBytes] = useState(initialData?.fileSizeBytes ?? 0);
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? false);
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
            placeholder="e.g. 999 = $9.99"
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
            placeholder="e.g. 899 = €8.99"
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
            placeholder="e.g. 799 = £7.99"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            defaultValue={initialData?.category || ""}
            placeholder="e.g. workbook, toolkit, guide"
          />
          <p className="text-xs text-muted-foreground">Optional — for future filtering</p>
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
