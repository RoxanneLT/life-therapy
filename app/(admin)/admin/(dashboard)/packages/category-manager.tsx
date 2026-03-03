"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { renamePackageCategory, deletePackageCategory } from "./actions";

interface PackageCategoryManagerProps {
  categories: { name: string; count: number }[];
}

export function PackageCategoryManager({ categories }: PackageCategoryManagerProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function handleRename(oldName: string) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== oldName) {
      await renamePackageCategory(oldName, trimmed);
    }
    setEditing(null);
  }

  async function handleDelete(name: string) {
    if (confirm(`Remove category "${name}"? Packages will become uncategorized.`)) {
      await deletePackageCategory(name);
    }
  }

  if (categories.length === 0) return null;

  return (
    <div className="mb-6 rounded-md border bg-background p-4">
      <h2 className="mb-3 text-sm font-semibold">Categories</h2>
      <div className="flex flex-wrap gap-2">
        {categories.map(({ name, count }) =>
          editing === name ? (
            <div key={name} className="flex items-center gap-1">
              <Input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(name);
                  if (e.key === "Escape") setEditing(null);
                }}
                className="h-7 w-36 text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleRename(name)}
              >
                <Check className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditing(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div key={name} className="group flex items-center gap-1">
              <Badge variant="secondary" className="text-xs">
                {name}
                <span className="ml-1 text-muted-foreground">({count})</span>
              </Badge>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => {
                  setEditing(name);
                  setEditValue(name);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => handleDelete(name)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ),
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Hover to rename or remove. Renaming a category updates all packages using it.
      </p>
    </div>
  );
}
