"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SeoFieldsProps {
  metaTitle?: string;
  metaDescription?: string;
}

export function SeoFields({ metaTitle = "", metaDescription = "" }: SeoFieldsProps) {
  const [open, setOpen] = useState(!!(metaTitle || metaDescription));
  const [titleLen, setTitleLen] = useState(metaTitle.length);
  const [descLen, setDescLen] = useState(metaDescription.length);

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-left font-medium"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        SEO Settings
      </button>

      {open && (
        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="metaTitle">Meta Title</Label>
              <span className={`text-xs ${titleLen > 60 ? "text-amber-600" : "text-muted-foreground"}`}>
                {titleLen}/70
              </span>
            </div>
            <Input
              id="metaTitle"
              name="metaTitle"
              defaultValue={metaTitle}
              onChange={(e) => setTitleLen(e.target.value.length)}
              placeholder="Page title for search engines"
              maxLength={70}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="metaDescription">Meta Description</Label>
              <span className={`text-xs ${descLen > 160 ? "text-amber-600" : "text-muted-foreground"}`}>
                {descLen}/320
              </span>
            </div>
            <Textarea
              id="metaDescription"
              name="metaDescription"
              defaultValue={metaDescription}
              onChange={(e) => setDescLen(e.target.value.length)}
              placeholder="Brief description shown in search results"
              rows={3}
              maxLength={320}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Leave blank to use the page title and description as defaults.
          </p>
        </div>
      )}
    </div>
  );
}
