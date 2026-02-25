"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableHeaderProps {
  field: string;
  label: string;
  currentSort: string;
  currentDir: string;
  className?: string;
  basePath?: string;
}

export function SortableHeader({
  field,
  label,
  currentSort,
  currentDir,
  className,
  basePath,
}: SortableHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const isActive = currentSort === field;

  function handleClick() {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("sort", field);
    if (isActive) {
      sp.set("dir", currentDir === "asc" ? "desc" : "asc");
    } else {
      sp.set("dir", "asc");
    }
    router.push(`${basePath ?? pathname}?${sp.toString()}`);
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
