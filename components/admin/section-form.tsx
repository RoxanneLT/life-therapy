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
import { Loader2 } from "lucide-react";

const SECTION_TYPES = [
  { value: "hero", label: "Hero Banner" },
  { value: "text", label: "Text Block" },
  { value: "image_text", label: "Image + Text" },
  { value: "cta", label: "Call to Action" },
  { value: "testimonial_carousel", label: "Testimonials" },
  { value: "course_grid", label: "Course Grid" },
  { value: "course_catalog", label: "Course Catalog (full page)" },
  { value: "bundle_grid", label: "Bundle Grid" },
  { value: "features", label: "Features / Cards" },
  { value: "pricing", label: "Pricing Cards" },
  { value: "steps", label: "Steps / How It Works" },
  { value: "faq", label: "FAQ Accordion" },
];

interface SectionFormProps {
  initialData?: {
    id?: string;
    sectionType: string;
    title?: string | null;
    subtitle?: string | null;
    content?: string | null;
    imageUrl?: string | null;
    imageAlt?: string | null;
    ctaText?: string | null;
    ctaLink?: string | null;
    config?: Record<string, unknown> | null;
    isVisible?: boolean;
  };
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}

export function SectionForm({
  initialData,
  onSubmit,
  onCancel,
}: SectionFormProps) {
  const [sectionType, setSectionType] = useState(
    initialData?.sectionType || "text"
  );
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [isVisible, setIsVisible] = useState(initialData?.isVisible ?? true);
  const [configJson, setConfigJson] = useState(
    initialData?.config ? JSON.stringify(initialData.config, null, 2) : ""
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("sectionType", sectionType);
    formData.set("imageUrl", imageUrl);
    formData.set("isVisible", String(isVisible));
    if (configJson.trim()) {
      formData.set("config", configJson);
    }
    await onSubmit(formData);
    setSubmitting(false);
  }

  const showImage = ["hero", "image_text"].includes(sectionType);
  const showContent = ["hero", "text", "image_text", "cta"].includes(
    sectionType
  );
  const showCta = ["hero", "image_text", "cta"].includes(sectionType);
  const showConfig = [
    "features",
    "faq",
    "course_grid",
    "course_catalog",
    "bundle_grid",
    "testimonial_carousel",
    "pricing",
    "steps",
    "hero",
    "image_text",
  ].includes(sectionType);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Section Type</Label>
        <Select value={sectionType} onValueChange={setSectionType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initialData?.title || ""}
          placeholder="Section title"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input
          id="subtitle"
          name="subtitle"
          defaultValue={initialData?.subtitle || ""}
          placeholder="Optional subtitle"
        />
      </div>

      {showContent && (
        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            name="content"
            defaultValue={initialData?.content || ""}
            placeholder="Main content text..."
            rows={5}
          />
        </div>
      )}

      {showImage && (
        <div className="space-y-2">
          <Label>Image</Label>
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
          <Input
            name="imageAlt"
            defaultValue={initialData?.imageAlt || ""}
            placeholder="Image alt text"
          />
        </div>
      )}

      {showCta && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ctaText">CTA Text</Label>
            <Input
              id="ctaText"
              name="ctaText"
              defaultValue={initialData?.ctaText || ""}
              placeholder="Button text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctaLink">CTA Link</Label>
            <Input
              id="ctaLink"
              name="ctaLink"
              defaultValue={initialData?.ctaLink || ""}
              placeholder="/courses"
            />
          </div>
        </div>
      )}

      {showConfig && (
        <div className="space-y-2">
          <Label htmlFor="config">Configuration (JSON)</Label>
          <Textarea
            id="config"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            placeholder='{"key": "value"}'
            rows={4}
            className="font-mono text-sm"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={isVisible} onCheckedChange={setIsVisible} />
        <Label>Visible</Label>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initialData?.id ? "Save Changes" : "Add Section"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
