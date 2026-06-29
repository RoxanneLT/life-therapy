"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/admin/image-upload";
import { SettingsPageHeader } from "@/components/admin/settings/settings-page-header";
import {
  ClientNameCombobox,
  type ClientOption,
} from "@/components/admin/client-name-combobox";
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
  /** Client suggestions for the name field (typeahead + location autofill). */
  clients?: ClientOption[];
  /** Header (sticky) configuration. */
  headerTitle: string;
  headerDescription?: string;
  backHref?: string;
  backLabel?: string;
  /** Extra header actions rendered to the left of Save (e.g. a Delete button). */
  headerActions?: ReactNode;
}

export function TestimonialForm({
  initialData,
  onSubmit,
  clients = [],
  headerTitle,
  headerDescription,
  backHref,
  backLabel,
  headerActions,
}: TestimonialFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [location, setLocation] = useState(initialData?.location || "");
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
    <form onSubmit={handleSubmit}>
      <SettingsPageHeader
        title={headerTitle}
        description={headerDescription}
        backHref={backHref}
        backLabel={backLabel}
        actions={
          <>
            {headerActions}
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? "Save Changes" : "Create Testimonial"}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {/* Details / settings */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Line 1: Client · Location · Type · Role */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name</Label>
                <ClientNameCombobox
                  id="name"
                  name="name"
                  value={name}
                  onChange={setName}
                  onSelectClient={(c) => setName(c.fillName)}
                  clients={clients}
                  placeholder="Start typing a client name…"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Cape Town, South Africa"
                />
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="session">1:1 Session</SelectItem>
                    <SelectItem value="course">Course</SelectItem>
                  </SelectContent>
                </Select>
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

            {/* Line 2: Rating · Sort Order · Published · Featured */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex h-9 items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-0.5"
                      aria-label={`${star} star${star === 1 ? "" : "s"}`}
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
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  defaultValue={initialData?.sortOrder ?? 0}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Published</Label>
                <div className="flex h-9 items-center">
                  <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Featured</Label>
                <div className="flex h-9 items-center">
                  <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Testimonial + photo side by side */}
        <Card>
          <CardHeader>
            <CardTitle>Testimonial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <Label htmlFor="content">Testimonial</Label>
                <Textarea
                  id="content"
                  name="content"
                  defaultValue={initialData?.content || ""}
                  placeholder="What the client said..."
                  rows={8}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Client Photo (optional)</Label>
                <ImageUpload value={imageUrl} onChange={setImageUrl} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
