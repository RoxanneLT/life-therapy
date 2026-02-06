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
import { Star, Loader2 } from "lucide-react";

interface TestimonialFormProps {
  initialData?: {
    id: string;
    name: string;
    role?: string | null;
    location?: string | null;
    content: string;
    rating: number;
    imageUrl?: string | null;
    serviceType: string;
    isPublished: boolean;
    isFeatured: boolean;
    sortOrder: number;
  };
  onSubmit: (formData: FormData) => Promise<void>;
}

export function TestimonialForm({
  initialData,
  onSubmit,
}: TestimonialFormProps) {
  const [rating, setRating] = useState(initialData?.rating ?? 5);
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [serviceType, setServiceType] = useState(
    initialData?.serviceType || "session"
  );
  const [isPublished, setIsPublished] = useState(
    initialData?.isPublished ?? false
  );
  const [isFeatured, setIsFeatured] = useState(
    initialData?.isFeatured ?? false
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("rating", String(rating));
    formData.set("imageUrl", imageUrl);
    formData.set("serviceType", serviceType);
    formData.set("isPublished", String(isPublished));
    formData.set("isFeatured", String(isFeatured));
    await onSubmit(formData);
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Client Name</Label>
          <Input
            id="name"
            name="name"
            defaultValue={initialData?.name || ""}
            placeholder="Sarah M."
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role / Title</Label>
          <Input
            id="role"
            name="role"
            defaultValue={initialData?.role || ""}
            placeholder="1:1 Client"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          name="location"
          defaultValue={initialData?.location || ""}
          placeholder="Cape Town, South Africa"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Testimonial</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={initialData?.content || ""}
          placeholder="What the client said..."
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Rating</Label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className="p-0.5"
            >
              <Star
                className={`h-5 w-5 ${
                  star <= rating
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Service Type</Label>
        <Select value={serviceType} onValueChange={setServiceType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="session">1:1 Session</SelectItem>
            <SelectItem value="course">Course</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Client Photo (optional)</Label>
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
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
        {initialData ? "Save Changes" : "Create Testimonial"}
      </Button>
    </form>
  );
}
