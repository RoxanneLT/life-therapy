"use client";

import { useState } from "react";
import { updatePageSeo } from "@/app/(admin)/admin/(dashboard)/seo/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Pencil, Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface PageSeoRow {
  id: string;
  route: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  keywords: string | null;
}

interface SeoManagerProps {
  pages: PageSeoRow[];
}

const ROUTE_LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About",
  "/sessions": "Sessions",
  "/courses": "Courses",
  "/packages": "Packages",
  "/products": "Products",
  "/book": "Book a Session",
  "/contact": "Contact",
};

export function SeoManager({ pages }: SeoManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<PageSeoRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [titleLen, setTitleLen] = useState(0);
  const [descLen, setDescLen] = useState(0);

  function openSheet(page: PageSeoRow) {
    setEditing(page);
    setOgImageUrl(page.ogImageUrl || "");
    setTitleLen(page.metaTitle?.length || 0);
    setDescLen(page.metaDescription?.length || 0);
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("ogImageUrl", ogImageUrl);

    await updatePageSeo(editing.id, formData);

    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => {
      setEditing(null);
      setSaved(false);
    }, 600);
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Page</TableHead>
              <TableHead>Meta Title</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="font-medium">
                  {ROUTE_LABELS[page.route] || page.route}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-sm">
                  {page.metaTitle || <span className="text-muted-foreground italic">Not set</span>}
                </TableCell>
                <TableCell className="hidden max-w-[300px] truncate text-sm text-muted-foreground md:table-cell">
                  {page.metaDescription || <span className="italic">Not set</span>}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openSheet(page)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              Edit SEO — {editing ? ROUTE_LABELS[editing.route] || editing.route : ""}
            </SheetTitle>
          </SheetHeader>

          {editing && (
            <form onSubmit={handleSave} className="mt-6 space-y-6">
              <div className="space-y-2">
                <Label>Route</Label>
                <p className="rounded-md bg-muted px-3 py-2 text-sm font-mono">
                  {editing.route}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-metaTitle">Meta Title</Label>
                  <span className={`text-xs ${titleLen > 60 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {titleLen}/70
                  </span>
                </div>
                <Input
                  id="seo-metaTitle"
                  name="metaTitle"
                  defaultValue={editing.metaTitle || ""}
                  onChange={(e) => setTitleLen(e.target.value.length)}
                  placeholder="Page title for search engines"
                  maxLength={70}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="seo-metaDescription">Meta Description</Label>
                  <span className={`text-xs ${descLen > 160 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {descLen}/320
                  </span>
                </div>
                <Textarea
                  id="seo-metaDescription"
                  name="metaDescription"
                  defaultValue={editing.metaDescription || ""}
                  onChange={(e) => setDescLen(e.target.value.length)}
                  placeholder="Brief description shown in search results"
                  rows={4}
                  maxLength={320}
                />
              </div>

              <div className="space-y-2">
                <Label>OG Image</Label>
                <ImageUpload value={ogImageUrl} onChange={setOgImageUrl} />
                <p className="text-xs text-muted-foreground">
                  Image shown when this page is shared on social media (1200x630 recommended).
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-keywords">Keywords</Label>
                <Input
                  id="seo-keywords"
                  name="keywords"
                  defaultValue={editing.keywords || ""}
                  placeholder="comma, separated, keywords"
                />
                <p className="text-xs text-muted-foreground">
                  Optional — most search engines no longer use this.
                </p>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : null}
                {saved ? "Saved" : "Save Changes"}
              </Button>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
