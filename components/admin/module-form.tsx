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
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";

const STANDALONE_CATEGORIES = [
  { value: "self_esteem", label: "Self-Esteem & Confidence" },
  { value: "mental_wellness", label: "Mental Wellness" },
  { value: "relationships", label: "Relationships" },
  { value: "specialised", label: "Specialised" },
];

interface ModuleFormProps {
  initialData?: {
    id: string;
    title: string;
    description?: string | null;
    sortOrder: number;
    standaloneSlug?: string | null;
    standaloneTitle?: string | null;
    standaloneDescription?: string | null;
    standaloneImageUrl?: string | null;
    standalonePrice?: number | null;
    isStandalonePublished: boolean;
    standaloneCategory?: string | null;
    previewVideoUrl?: string | null;
    facilitatorScript?: string | null;
  };
  onSubmit: (formData: FormData) => Promise<void>;
}

export function ModuleForm({ initialData, onSubmit }: ModuleFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showStandalone, setShowStandalone] = useState(
    initialData?.isStandalonePublished ?? false
  );
  const [isStandalonePublished, setIsStandalonePublished] = useState(
    initialData?.isStandalonePublished ?? false
  );
  const [standaloneSlug, setStandaloneSlug] = useState(
    initialData?.standaloneSlug || ""
  );
  const [standaloneImageUrl, setStandaloneImageUrl] = useState(
    initialData?.standaloneImageUrl || ""
  );
  const [standaloneCategory, setStandaloneCategory] = useState(
    initialData?.standaloneCategory || ""
  );

  function handleStandaloneTitleChange(value: string) {
    if (!initialData?.standaloneSlug) {
      setStandaloneSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("isStandalonePublished", String(isStandalonePublished));
    formData.set("standaloneSlug", standaloneSlug);
    formData.set("standaloneImageUrl", standaloneImageUrl);
    formData.set("standaloneCategory", standaloneCategory);
    await onSubmit(formData);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Module Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initialData?.title || ""}
          placeholder="e.g. Introduction to Self-Awareness"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initialData?.description || ""}
          placeholder="Brief description of what this module covers..."
          rows={3}
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
          className="w-24"
        />
      </div>

      {/* Sell as Short Course — collapsible */}
      <div className="rounded-lg border">
        <button
          type="button"
          className="flex w-full items-center gap-2 p-4 text-left font-medium hover:bg-muted/50"
          onClick={() => setShowStandalone(!showStandalone)}
        >
          {showStandalone ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Sell as Short Course
          {isStandalonePublished && (
            <span className="ml-auto text-xs font-normal text-green-600">
              Published
            </span>
          )}
        </button>

        {showStandalone && (
          <div className="space-y-4 border-t p-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={isStandalonePublished}
                onCheckedChange={setIsStandalonePublished}
              />
              <Label>Publish as standalone short course</Label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="standaloneTitle">Short Course Title</Label>
                <Input
                  id="standaloneTitle"
                  name="standaloneTitle"
                  defaultValue={initialData?.standaloneTitle || ""}
                  placeholder="Title shown on short course pages"
                  onChange={(e) =>
                    handleStandaloneTitleChange(e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="standaloneSlug">Slug</Label>
                <Input
                  id="standaloneSlug"
                  name="standaloneSlug"
                  value={standaloneSlug}
                  onChange={(e) => setStandaloneSlug(e.target.value)}
                  placeholder="auto-generated-from-title"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="standaloneDescription">
                Short Course Description
              </Label>
              <Textarea
                id="standaloneDescription"
                name="standaloneDescription"
                defaultValue={initialData?.standaloneDescription || ""}
                placeholder="Description for the standalone short course listing..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Short Course Image</Label>
              <ImageUpload
                value={standaloneImageUrl}
                onChange={setStandaloneImageUrl}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="standalonePrice">Price (ZAR cents)</Label>
                <Input
                  id="standalonePrice"
                  name="standalonePrice"
                  type="number"
                  defaultValue={initialData?.standalonePrice ?? ""}
                  min={0}
                  placeholder="e.g. 14900 = R149"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={standaloneCategory}
                  onValueChange={setStandaloneCategory}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDALONE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}
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
            Short intro video shown on the module/short course page
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="facilitatorScript">Facilitator Script</Label>
          <Textarea
            id="facilitatorScript"
            name="facilitatorScript"
            defaultValue={initialData?.facilitatorScript || ""}
            placeholder="Script for Sofia Hart to introduce this module..."
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Not shown publicly — used to produce the preview video
          </p>
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData ? "Save Changes" : "Create Module"}
      </Button>
    </form>
  );
}
