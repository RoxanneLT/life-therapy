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
import { Loader2 } from "lucide-react";

const LECTURE_TYPES = [
  { value: "video", label: "Video" },
  { value: "text", label: "Text / Reading" },
  { value: "quiz", label: "Quiz" },
];

interface LectureFormProps {
  initialData?: {
    id: string;
    title: string;
    lectureType: string;
    videoUrl?: string | null;
    textContent?: string | null;
    worksheetUrl?: string | null;
    durationSeconds?: number | null;
    isPreview: boolean;
    sortOrder: number;
  };
  onSubmit: (formData: FormData) => Promise<void>;
}

export function LectureForm({ initialData, onSubmit }: LectureFormProps) {
  const [lectureType, setLectureType] = useState(
    initialData?.lectureType || "video"
  );
  const [isPreview, setIsPreview] = useState(initialData?.isPreview ?? false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("lectureType", lectureType);
    formData.set("isPreview", String(isPreview));
    await onSubmit(formData);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="title">Lecture Title</Label>
          <Input
            id="title"
            name="title"
            defaultValue={initialData?.title || ""}
            placeholder="e.g. Understanding Your Values"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={lectureType} onValueChange={setLectureType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LECTURE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {lectureType === "video" && (
        <div className="space-y-2">
          <Label htmlFor="videoUrl">Video URL</Label>
          <Input
            id="videoUrl"
            name="videoUrl"
            defaultValue={initialData?.videoUrl || ""}
            placeholder="https://www.youtube.com/watch?v=... or Vimeo URL"
          />
        </div>
      )}

      {(lectureType === "text" || lectureType === "video") && (
        <div className="space-y-2">
          <Label htmlFor="textContent">
            {lectureType === "video" ? "Notes / Transcript" : "Content"}
          </Label>
          <Textarea
            id="textContent"
            name="textContent"
            defaultValue={initialData?.textContent || ""}
            placeholder="Lecture content or notes..."
            rows={8}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="worksheetUrl">Worksheet / PDF URL</Label>
        <Input
          id="worksheetUrl"
          name="worksheetUrl"
          defaultValue={initialData?.worksheetUrl || ""}
          placeholder="Link to downloadable worksheet (optional)"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="durationSeconds">Duration (seconds)</Label>
          <Input
            id="durationSeconds"
            name="durationSeconds"
            type="number"
            defaultValue={initialData?.durationSeconds ?? ""}
            min={0}
            placeholder="e.g. 600"
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
        <div className="flex items-end gap-2 pb-1">
          <Switch checked={isPreview} onCheckedChange={setIsPreview} />
          <Label>Free Preview</Label>
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialData ? "Save Changes" : "Create Lecture"}
      </Button>
    </form>
  );
}
