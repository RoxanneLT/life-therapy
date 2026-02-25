"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/admin/image-upload";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SectionForm } from "@/components/admin/section-form";
import {
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  togglePagePublished,
  toggleSectionVisibility,
} from "./actions";
import { updatePageSeo } from "@/app/(admin)/admin/(dashboard)/seo/actions";
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PageData {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  sections: SectionData[];
}

interface SectionData {
  id: string;
  sectionType: string;
  title: string | null;
  subtitle: string | null;
  content: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  ctaText: string | null;
  ctaLink: string | null;
  config: Record<string, unknown> | null;
  sortOrder: number;
  isVisible: boolean;
}

interface SeoData {
  id: string;
  route: string;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  keywords: string | null;
}

interface PageEditorProps {
  initialPage: PageData;
  seo: SeoData | null;
  activeTab: "content" | "seo";
}

export function PageEditor({ initialPage, seo, activeTab }: PageEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PageData>(initialPage);
  const [editingSection, setEditingSection] = useState<SectionData | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const tab = activeTab;

  function setTab(newTab: "content" | "seo") {
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === "seo") {
      params.set("tab", "seo");
    } else {
      params.delete("tab");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }

  const fetchPage = useCallback(async () => {
    try {
      const res = await fetch(`/api/pages/${page.slug}`);
      if (res.ok) {
        setPage(await res.json());
      } else {
        console.error("Failed to refresh page data:", res.status);
      }
    } catch (err) {
      console.error("Failed to refresh page data:", err);
    }
  }, [page.slug]);

  async function handleAddSection(formData: FormData) {
    await createSection(page.id, formData);
    setAddDialogOpen(false);
    fetchPage();
  }

  async function handleUpdateSection(formData: FormData) {
    if (!editingSection) return;
    await updateSection(editingSection.id, formData);
    setEditDialogOpen(false);
    setEditingSection(null);
    fetchPage();
  }

  async function handleDelete(sectionId: string) {
    await deleteSection(sectionId);
    fetchPage();
  }

  async function handleMove(index: number, direction: "up" | "down") {
    const sections = [...page.sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sections.length) return;

    [sections[index], sections[swapIndex]] = [
      sections[swapIndex],
      sections[index],
    ];

    await reorderSections(
      page.id,
      sections.map((s) => s.id)
    );
    fetchPage();
  }

  async function handleTogglePublished() {
    await togglePagePublished(page.id);
    fetchPage();
  }

  async function handleToggleVisibility(sectionId: string) {
    await toggleSectionVisibility(sectionId);
    fetchPage();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">{page.title}</h1>
          <p className="text-sm text-muted-foreground">
            /{page.slug === "home" ? "" : page.slug} &middot;{" "}
            {page.sections.length} sections
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={page.isPublished ? "default" : "outline"}
            onClick={handleTogglePublished}
          >
            {page.isPublished ? "Published" : "Draft"}
          </Button>
          {tab === "content" && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Section
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Section</DialogTitle>
                </DialogHeader>
                <SectionForm
                  onSubmit={handleAddSection}
                  onCancel={() => setAddDialogOpen(false)}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab("content")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "content"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Content
        </button>
        <button
          type="button"
          onClick={() => setTab("seo")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "seo"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          SEO
        </button>
      </div>

      {/* Content Tab */}
      {tab === "content" && (
        <>
          <div className="space-y-3">
            {page.sections.map((section, index) => (
              <Card
                key={section.id}
                className={section.isVisible ? "" : "opacity-50"}
              >
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === 0}
                        onClick={() => handleMove(index, "up")}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === page.sections.length - 1}
                        onClick={() => handleMove(index, "down")}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{section.sectionType}</Badge>
                        <CardTitle className="text-sm">
                          {section.title || "(Untitled)"}
                        </CardTitle>
                      </div>
                      {section.subtitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {section.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleVisibility(section.id)}
                    >
                      {section.isVisible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingSection(section);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete section?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the &ldquo;
                            {section.title || section.sectionType}&rdquo; section.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(section.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
              </Card>
            ))}

            {page.sections.length === 0 && (
              <div className="rounded-lg border border-dashed p-12 text-center">
                <p className="text-muted-foreground">
                  No sections yet. Click &ldquo;Add Section&rdquo; to start
                  building this page.
                </p>
              </div>
            )}
          </div>

          {/* Edit dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Section</DialogTitle>
              </DialogHeader>
              {editingSection && (
                <SectionForm
                  initialData={editingSection}
                  onSubmit={handleUpdateSection}
                  onCancel={() => {
                    setEditDialogOpen(false);
                    setEditingSection(null);
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* SEO Tab */}
      {tab === "seo" && (
        <SeoTab seo={seo} pageSlug={page.slug} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SEO Tab — inline component                                        */
/* ------------------------------------------------------------------ */

function SeoTab({ seo, pageSlug }: { seo: SeoData | null; pageSlug: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [titleLen, setTitleLen] = useState(seo?.metaTitle?.length || 0);
  const [descLen, setDescLen] = useState(seo?.metaDescription?.length || 0);
  const [ogImageUrl, setOgImageUrl] = useState(seo?.ogImageUrl || "");

  const route = pageSlug === "home" ? "/" : `/${pageSlug}`;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!seo) return;

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set("ogImageUrl", ogImageUrl);

    await updatePageSeo(seo.id, formData);

    setSaving(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1500);
  }

  if (!seo) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            No SEO record found for route <code className="font-mono text-sm">{route}</code>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            SEO records are created automatically for each page route.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Engine Optimisation</CardTitle>
        <CardDescription>
          Meta tags for <code className="font-mono text-sm">{route}</code> — controls how this page appears in search results and social shares.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-metaTitle">Meta Title</Label>
              <span className={cn("text-xs", titleLen > 60 ? "text-amber-600" : "text-muted-foreground")}>
                {titleLen}/70
              </span>
            </div>
            <Input
              id="seo-metaTitle"
              name="metaTitle"
              defaultValue={seo.metaTitle || ""}
              onChange={(e) => setTitleLen(e.target.value.length)}
              placeholder="Page title for search engines"
              maxLength={70}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo-metaDescription">Meta Description</Label>
              <span className={cn("text-xs", descLen > 160 ? "text-amber-600" : "text-muted-foreground")}>
                {descLen}/320
              </span>
            </div>
            <Textarea
              id="seo-metaDescription"
              name="metaDescription"
              defaultValue={seo.metaDescription || ""}
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
              defaultValue={seo.keywords || ""}
              placeholder="comma, separated, keywords"
            />
            <p className="text-xs text-muted-foreground">
              Optional — most search engines no longer use this.
            </p>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-2 h-4 w-4" />
            ) : null}
            {saved ? "Saved" : "Save SEO"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
