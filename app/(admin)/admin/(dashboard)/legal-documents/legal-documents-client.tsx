"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock,
  FileText,
  History,
  Pencil,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Users,
  Globe,
  ScrollText,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { publishDocumentVersionAction } from "./actions";
import type { LegalDocumentSlug } from "@/lib/legal-documents";

interface Section {
  heading: string;
  content: string;
}

interface DocumentVersion {
  id: string;
  version: number;
  title: string;
  content: Section[];
  changeSummary: string | null;
  publishedAt: string | null;
  isActive: boolean;
  acceptanceCount: number;
}

interface DocumentData {
  slug: string;
  active: {
    id: string;
    title: string;
    content: Section[];
    version: number;
    publishedAt: string | null;
    changeSummary: string | null;
  } | null;
  stats: { total: number; accepted: number; pending: number } | null;
  requiresAcceptance: boolean;
  history: DocumentVersion[];
}

interface LegalDocumentsClientProps {
  readonly documents: DocumentData[];
  readonly adminUserId: string;
}

const SLUG_META: Record<string, { label: string; icon: typeof ScrollText }> = {
  commitment: { label: "My Commitment", icon: ScrollText },
  terms: { label: "Terms & Conditions", icon: ShieldCheck },
  privacy: { label: "Privacy Policy", icon: Lock },
};

export function LegalDocumentsClient({
  documents,
  adminUserId,
}: LegalDocumentsClientProps) {
  const [activeSlug, setActiveSlug] = useState(documents[0]?.slug ?? "commitment");
  const [editDoc, setEditDoc] = useState<DocumentData | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DocumentData | null>(null);
  const [viewVersion, setViewVersion] = useState<DocumentVersion | null>(null);

  const activeDoc = documents.find((d) => d.slug === activeSlug) ?? null;

  return (
    <>
      <div className="flex flex-col md:flex-row md:h-[calc(100vh-10rem)] gap-6">
        {/* Mobile nav */}
        <div className="md:hidden space-y-4">
          <div>
            <h2 className="font-heading text-xl font-bold">Legal</h2>
            <p className="text-xs text-muted-foreground">
              Manage legal documents
            </p>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b pb-px scrollbar-none">
            {documents.map((doc) => {
              const meta = SLUG_META[doc.slug];
              const Icon = meta?.icon ?? FileText;
              return (
                <button
                  key={doc.slug}
                  type="button"
                  onClick={() => setActiveSlug(doc.slug)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
                    activeSlug === doc.slug
                      ? "border-brand-600 text-brand-700"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta?.label ?? doc.slug}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden md:flex w-48 shrink-0 flex-col">
          <div className="mb-5">
            <h2 className="font-heading text-xl font-bold">Legal</h2>
            <p className="text-xs text-muted-foreground">
              Manage legal documents
            </p>
          </div>

          <nav className="flex-1 space-y-0.5">
            {documents.map((doc) => {
              const meta = SLUG_META[doc.slug];
              const Icon = meta?.icon ?? FileText;
              return (
                <button
                  key={doc.slug}
                  type="button"
                  onClick={() => setActiveSlug(doc.slug)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                    activeSlug === doc.slug
                      ? "bg-brand-50 text-brand-700"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {meta?.label ?? doc.slug}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content area */}
        <div className="min-w-0 flex-1 overflow-y-auto pr-1">
          {activeDoc && <DocumentDetail doc={activeDoc} onEdit={() => setEditDoc(activeDoc)} onHistory={() => setHistoryDoc(activeDoc)} />}
        </div>
      </div>

      {editDoc && (
        <EditDialog
          doc={editDoc}
          adminUserId={adminUserId}
          onClose={() => setEditDoc(null)}
        />
      )}

      {historyDoc && (
        <HistoryDialog
          doc={historyDoc}
          onClose={() => setHistoryDoc(null)}
          onViewVersion={setViewVersion}
        />
      )}

      {viewVersion && (
        <ViewVersionDialog
          version={viewVersion}
          onClose={() => setViewVersion(null)}
        />
      )}
    </>
  );
}

/* ─── Document Detail Panel ──────────────────────────────── */

function DocumentDetail({
  doc,
  onEdit,
  onHistory,
}: {
  doc: DocumentData;
  onEdit: () => void;
  onHistory: () => void;
}) {
  const active = doc.active;

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>
                {active?.title ?? SLUG_META[doc.slug]?.label ?? doc.slug}
              </CardTitle>
              <CardDescription className="mt-1">
                {active ? (
                  <>
                    Version {active.version}
                    {active.publishedAt && (
                      <>
                        {" · "}Published{" "}
                        {format(new Date(active.publishedAt), "d MMM yyyy")}
                      </>
                    )}
                  </>
                ) : (
                  "No version published yet"
                )}
              </CardDescription>
            </div>
            {active && (
              <Badge className="bg-green-100 text-green-700">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {doc.requiresAcceptance && doc.stats ? (
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Accepted by {doc.stats.accepted}/{doc.stats.total} clients
                  {doc.stats.pending > 0 && (
                    <span className="text-amber-600">
                      ({doc.stats.pending} pending)
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Public page only
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onHistory}>
                <History className="mr-1.5 h-3.5 w-3.5" />
                History
              </Button>
              <Button size="sm" onClick={onEdit}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit &amp; Publish
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content preview */}
      {active && active.content.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content Preview</CardTitle>
            <CardDescription>
              {active.content.length} section{active.content.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {active.content.map((section) => (
              <div key={section.heading}>
                <h3 className="text-sm font-semibold">{section.heading}</h3>
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
                  {section.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Change summary */}
      {active?.changeSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last Change</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm italic text-muted-foreground">
              &ldquo;{active.changeSummary}&rdquo;
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ─── Edit Dialog ────────────────────────────────────────── */

function EditDialog({
  doc,
  adminUserId,
  onClose,
}: {
  doc: DocumentData;
  adminUserId: string;
  onClose: () => void;
}) {
  const active = doc.active;
  const [title, setTitle] = useState(
    active?.title ?? SLUG_META[doc.slug]?.label ?? ""
  );
  const [sections, setSections] = useState<Section[]>(
    active?.content ? [...active.content] : [{ heading: "", content: "" }]
  );
  const [changeSummary, setChangeSummary] = useState("");
  const [isPending, startTransition] = useTransition();

  function addSection() {
    setSections([...sections, { heading: "", content: "" }]);
  }

  function removeSection(index: number) {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== index));
  }

  function moveSection(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const updated = [...sections];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setSections(updated);
  }

  function updateSection(index: number, field: keyof Section, value: string) {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  }

  function handlePublish() {
    if (!changeSummary.trim()) {
      toast.error("Change summary is required");
      return;
    }

    startTransition(async () => {
      try {
        const result = await publishDocumentVersionAction(
          doc.slug as LegalDocumentSlug,
          sections,
          title,
          changeSummary,
          adminUserId
        );
        toast.success(
          `Version ${result.version} published. ${result.clientsAffected} clients will need to re-accept.`
        );
        onClose();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to publish"
        );
      }
    });
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Edit: {active?.title ?? SLUG_META[doc.slug]?.label ?? doc.slug}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Document Title</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Sections</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSection}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Section
              </Button>
            </div>

            {sections.map((section, i) => (
              <Card key={i} className="p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Section heading"
                      value={section.heading}
                      onChange={(e) =>
                        updateSection(i, "heading", e.target.value)
                      }
                    />
                    <Textarea
                      placeholder="Section content..."
                      value={section.content}
                      onChange={(e) =>
                        updateSection(i, "content", e.target.value)
                      }
                      rows={4}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveSection(i, -1)}
                      disabled={i === 0}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => moveSection(i, 1)}
                      disabled={i === sections.length - 1}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-700"
                      onClick={() => removeSection(i)}
                      disabled={sections.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-summary">
              Change Summary <span className="text-red-500">*</span>
            </Label>
            <Input
              id="change-summary"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="e.g. Updated cancellation policy from 24h to 48h"
            />
            <p className="text-xs text-muted-foreground">
              Clients will see this when reviewing the updated document.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={isPending}>
              {isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Publish New Version
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── History Dialog ─────────────────────────────────────── */

function HistoryDialog({
  doc,
  onClose,
  onViewVersion,
}: {
  doc: DocumentData;
  onClose: () => void;
  onViewVersion: (v: DocumentVersion) => void;
}) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Version History: {doc.active?.title ?? SLUG_META[doc.slug]?.label ?? doc.slug}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          {doc.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No versions published yet.
            </p>
          ) : (
            doc.history.map((v) => (
              <div
                key={v.id}
                className="flex items-start justify-between rounded-md border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={v.isActive ? "default" : "secondary"}>
                      v{v.version}
                    </Badge>
                    {v.isActive && (
                      <span className="text-xs text-green-600">Active</span>
                    )}
                  </div>
                  {v.publishedAt && (
                    <p className="text-xs text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {format(new Date(v.publishedAt), "d MMM yyyy 'at' HH:mm")}
                    </p>
                  )}
                  {v.changeSummary && (
                    <p className="text-xs text-muted-foreground italic">
                      &ldquo;{v.changeSummary}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {v.acceptanceCount} acceptance
                    {v.acceptanceCount === 1 ? "" : "s"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onViewVersion(v);
                  }}
                >
                  <FileText className="mr-1 h-3.5 w-3.5" />
                  View
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── View Version Dialog ────────────────────────────────── */

function ViewVersionDialog({
  version,
  onClose,
}: {
  version: DocumentVersion;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {version.title} (v{version.version})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {version.content.map((section) => (
            <div key={section.heading}>
              <h3 className="text-sm font-semibold">{section.heading}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {section.content}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
