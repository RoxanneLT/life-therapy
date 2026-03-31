"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, Loader2 } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  clientStatus: string;
}

export function ClientSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search-clients?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  function handleSelect(id: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/admin/clients/${id}`);
  }

  const statusColors: Record<string, string> = {
    active: "text-green-600",
    potential: "text-blue-600",
    inactive: "text-gray-400",
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden sm:flex items-center gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Search clients...</span>
        <kbd className="ml-2 hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 sm:max-w-md">
          <VisuallyHidden>
            <DialogTitle>Search Clients</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {results.length === 0 && query.length >= 2 && !loading && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                No clients found
              </p>
            )}
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
                  <User className="h-3.5 w-3.5 text-brand-700 dark:text-brand-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <span className={`text-[10px] font-medium capitalize ${statusColors[r.clientStatus] || "text-gray-400"}`}>
                  {r.clientStatus}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
