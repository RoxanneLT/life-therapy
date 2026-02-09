"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteDripEmailAction } from "./actions";

interface DeleteDripEmailButtonProps {
  id: string;
  step: number;
}

export function DeleteDripEmailButton({ id, step }: DeleteDripEmailButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete step #${step}? Remaining steps will be re-indexed automatically.`)) {
      return;
    }
    startTransition(async () => {
      await deleteDripEmailAction(id);
    });
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      onClick={handleDelete}
      disabled={isPending}
      title={`Delete step #${step}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
