"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Check, X, Tags, FolderClosed } from "lucide-react";
import { toast } from "sonner";

export interface CategoryItem {
  name: string;
  count: number;
}

interface CategoryManagerProps {
  readonly categories: CategoryItem[];
  /** Singular noun for the items in a category, e.g. "product" or "package". */
  readonly noun: string;
  readonly onRename: (oldName: string, newName: string) => Promise<void>;
  readonly onDelete: (name: string) => Promise<void>;
}

/**
 * Read-only category pills on the page, with a "Manage" dialog for rename /
 * remove. Actions live in the dialog (always visible) rather than appearing on
 * hover — much clearer when there are many categories. Fully theme-aware.
 */
export function CategoryManager({ categories, noun, onRename, onDelete }: CategoryManagerProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (categories.length === 0) return null;

  const pluralNoun = (n: number) => `${n} ${noun}${n === 1 ? "" : "s"}`;

  function startEdit(name: string) {
    setConfirmingDelete(null);
    setEditing(name);
    setEditValue(name);
  }

  function saveRename(oldName: string) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldName) {
      setEditing(null);
      return;
    }
    startTransition(async () => {
      try {
        await onRename(oldName, trimmed);
        toast.success(`Renamed to “${trimmed}”`);
        setEditing(null);
      } catch {
        toast.error("Failed to rename category. Please try again.");
      }
    });
  }

  function removeCategory(name: string) {
    startTransition(async () => {
      try {
        await onDelete(name);
        toast.success(`Removed “${name}”`);
        setConfirmingDelete(null);
      } catch {
        toast.error("Failed to remove category. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-muted-foreground">Categories</span>

      {categories.map(({ name, count }) => (
        <span
          key={name}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
        >
          {name}
          <span className="text-muted-foreground">{count}</span>
        </span>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Tags className="h-3.5 w-3.5" />
            Manage
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage categories</DialogTitle>
            <DialogDescription>
              Renaming updates every {noun} in that category. Removing a category leaves its{" "}
              {noun}s uncategorized — it doesn&apos;t delete them.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            {categories.map(({ name, count }) => {
              const isEditing = editing === name;
              const isConfirming = confirmingDelete === name;

              return (
                <div
                  key={name}
                  className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
                >
                  {isEditing ? (
                    <>
                      <Input
                        autoFocus
                        value={editValue}
                        disabled={isPending}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename(name);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="h-8 flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={isPending}
                        onClick={() => saveRename(name)}
                        aria-label="Save name"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        disabled={isPending}
                        onClick={() => setEditing(null)}
                        aria-label="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : isConfirming ? (
                    <>
                      <span className="flex-1 text-sm">
                        Remove <strong>{name}</strong>? {pluralNoun(count)} will be uncategorized.
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => removeCategory(name)}
                      >
                        Remove
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <FolderClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm font-medium">{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {pluralNoun(count)}
                      </span>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(name)}
                        aria-label={`Rename ${name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          setEditing(null);
                          setConfirmingDelete(name);
                        }}
                        aria-label={`Remove ${name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
