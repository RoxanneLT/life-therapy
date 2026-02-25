"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "potential", label: "Potential" },
  { key: "inactive", label: "Inactive" },
  { key: "archived", label: "Archived" },
] as const;

interface ClientListFiltersProps {
  activeTab: string;
  search: string;
  counts: Record<string, number>;
}

export function ClientListFilters({ activeTab, search, counts }: ClientListFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(search);

  const navigate = useCallback(
    (params: Record<string, string | undefined>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
        else sp.delete(k);
      }
      router.push(`/admin/clients?${sp.toString()}`);
    },
    [router, searchParams],
  );

  function handleTabClick(tab: string) {
    setQuery("");
    navigate({ status: tab === "all" ? undefined : tab, q: undefined });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: query.trim() || undefined });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {counts[tab.key] !== undefined && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search clients..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-64"
        />
      </form>
    </div>
  );
}
