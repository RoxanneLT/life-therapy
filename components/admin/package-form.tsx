"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
import { PppPriceFields } from "@/components/admin/ppp-price-fields";

interface SelectOption {
  id: string;
  title: string;
}

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
    isFixed: boolean;
    fixedCourseIds: unknown;
    fixedDigitalProductIds: unknown;
    category?: string | null;
    isPublished: boolean;
    metaTitle?: string | null;
    metaDescription?: string | null;
  };
  categories?: string[];
  availableCourses?: SelectOption[];
  availableDigitalProducts?: SelectOption[];
  onSubmit: (formData: FormData) => Promise<void>;
}

function toStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

export function PackageForm({
  initialData,
  categories = [],
  availableCourses = [],
  availableDigitalProducts = [],
  onSubmit,
}: PackageFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl || "");
  const [isPublished, setIsPublished] = useState(initialData?.isPublished ?? false);
  const [isFixed, setIsFixed] = useState(initialData?.isFixed ?? false);
  const [fixedCourseIds, setFixedCourseIds] = useState<string[]>(
    toStringArray(initialData?.fixedCourseIds)
  );
  const [fixedDigitalProductIds, setFixedDigitalProductIds] = useState<string[]>(
    toStringArray(initialData?.fixedDigitalProductIds)
  );
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

  function toggleId(ids: string[], setIds: (v: string[]) => void, id: string) {
    setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    formData.set("slug", slug);
    formData.set("imageUrl", imageUrl);
    formData.set("category", category);
    formData.set("isPublished", String(isPublished));
    formData.set("isFixed", String(isFixed));
    formData.delete("fixedCourseIds");
    for (const id of fixedCourseIds) formData.append("fixedCourseIds", id);
    formData.delete("fixedDigitalProductIds");
    for (const id of fixedDigitalProductIds) formData.append("fixedDigitalProductIds", id);
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

      <PppPriceFields
        names={{ zar: "priceCents", usd: "priceCentsUsd", eur: "priceCentsEur", gbp: "priceCentsGbp" }}
        defaultZar={initialData?.priceCents ?? 0}
        defaultUsd={initialData?.priceCentsUsd}
        defaultEur={initialData?.priceCentsEur}
        defaultGbp={initialData?.priceCentsGbp}
      />

      {/* Package type toggle */}
      <div className="rounded-md border bg-muted/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Curated Package</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Admin picks exact contents — customer cannot change them
            </p>
          </div>
          <Switch checked={isFixed} onCheckedChange={setIsFixed} />
        </div>

        {isFixed ? (
          <div className="space-y-4 pt-2 border-t">
            {/* Fixed courses */}
            {availableCourses.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Included Courses
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableCourses.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={fixedCourseIds.includes(c.id)}
                        onCheckedChange={() => toggleId(fixedCourseIds, setFixedCourseIds, c.id)}
                      />
                      {c.title}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Fixed digital products */}
            {availableDigitalProducts.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Included Digital Products
                </Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {availableDigitalProducts.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent/50"
                    >
                      <Checkbox
                        checked={fixedDigitalProductIds.includes(p.id)}
                        onCheckedChange={() =>
                          toggleId(fixedDigitalProductIds, setFixedDigitalProductIds, p.id)
                        }
                      />
                      {p.title}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Credits for curated packages */}
            <div className="space-y-2 max-w-xs">
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
        ) : (
          <div className="grid gap-4 sm:grid-cols-3 pt-2 border-t">
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
        )}
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
