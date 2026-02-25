"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateClientStatusAction } from "../actions";
import { Loader2 } from "lucide-react";

const STATUSES = [
  { value: "potential", label: "Potential" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export function StatusSelect({
  clientId,
  currentStatus,
}: {
  clientId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(value: string) {
    if (value === currentStatus) return;
    startTransition(async () => {
      try {
        await updateClientStatusAction(clientId, value);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update status");
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={currentStatus} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  );
}
