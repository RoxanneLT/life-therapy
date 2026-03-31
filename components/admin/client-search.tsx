"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, User, Loader2 } from "lucide-react";

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  clientStatus: string;
}

export function ClientSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K to focus
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setFocused(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
    setQuery("");
    setResults([]);
    setFocused(false);
    router.push(`/admin/clients/${id}`);
  }

  const statusColors: Record<string, string> = {
    active: "text-green-600",
    potential: "text-blue-600",
    inactive: "text-gray-400",
  };

  const showDropdown = focused && (results.length > 0 || (query.length >= 2 && !loading));

  return (
    <div ref={wrapperRef} className="relative w-64 lg:w-80">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search clients..."
          className="pl-9 pr-16"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
          {results.length === 0 && query.length >= 2 && !loading && (
            <p className="p-3 text-center text-sm text-muted-foreground">
              No clients found
            </p>
          )}
          <div className="max-h-64 overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleSelect(r.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 shrink-0">
                  <User className="h-3 w-3 text-brand-700 dark:text-brand-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <span className={`text-[10px] font-medium capitalize shrink-0 ${statusColors[r.clientStatus] || "text-gray-400"}`}>
                  {r.clientStatus}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
