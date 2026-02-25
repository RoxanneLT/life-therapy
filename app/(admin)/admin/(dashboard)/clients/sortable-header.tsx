"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeaderProps {
  field: string;
  label: string;
  currentSort: string;
  currentDir: string;
  className?: string;
}

export function SortableHeader({
  field,
  label,
  currentSort,
  currentDir,
  className,
}: SortableHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isActive = currentSort === field;

  function handleClick() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("sort", field);
    // Toggle direction if already sorting by this field, otherwise default to asc
    if (isActive) {
      sp.set("dir", currentDir === "asc" ? "desc" : "asc");
    } else {
      sp.set("dir", "asc");
    }
    router.push(`/admin/clients?${sp.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium hover:text-foreground",
        isActive ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {label}
      {isActive ? (
        currentDir === "asc" ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="h-3.5 w-3.5" />
        )
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </button>
  );
}
