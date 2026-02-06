"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";

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

export default function PageEditorPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [page, setPage] = useState<PageData | null>(null);
  const [editingSection, setEditingSection] = useState<SectionData | null>(
    null
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchPage = useCallback(async () => {
    const res = await fetch(`/api/pages/${slug}`);
    if (res.ok) {
      setPage(await res.json());
    }
  }, [slug]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  if (!page) {
    return <div className="p-6">Loading...</div>;
  }

  async function handleAddSection(formData: FormData) {
    await createSection(page!.id, formData);
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
    const sections = [...page!.sections];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= sections.length) return;

    [sections[index], sections[swapIndex]] = [
      sections[swapIndex],
      sections[index],
    ];

    await reorderSections(
      page!.id,
      sections.map((s) => s.id)
    );
    fetchPage();
  }

  async function handleTogglePublished() {
    await togglePagePublished(page!.id);
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
        </div>
      </div>

      {/* Sections list */}
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
    </div>
  );
}
