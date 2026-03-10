"use client";

import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

interface SortableOrderBarProps {
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
}

export function SortableOrderBar({ dirty, saving, saved, onSave }: SortableOrderBarProps) {
  if (!dirty && !saved) return null;

  return (
    <div className="mb-4 flex items-center gap-3">
      {dirty && (
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Order
        </Button>
      )}
      {saved && (
        <span className="flex items-center gap-1 text-sm text-green-600">
          <Check className="h-4 w-4" /> Order saved
        </span>
      )}
      {dirty && (
        <span className="text-sm text-muted-foreground">
          Drag rows to reorder, then save
        </span>
      )}
    </div>
  );
}
