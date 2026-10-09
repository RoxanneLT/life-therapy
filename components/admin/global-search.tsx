"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Search, Loader2, User, CalendarDays, Receipt, ShoppingCart } from "lucide-react";
import type { SearchGroup } from "@/lib/admin-search";

const GROUP_ICONS: Record<SearchGroup["key"], React.ComponentType<{ className?: string }>> = {
  clients: User,
  bookings: CalendarDays,
  invoices: Receipt,
  orders: ShoppingCart,
};

interface GlobalSearchProps {
  readonly className?: string;
  readonly autoFocus?: boolean;
  /** Called after a result is opened, e.g. to close the mobile overlay. */
  readonly onNavigate?: () => void;
}

/** Header search over clients, bookings, invoices and orders (lib/admin-search.ts). Ctrl/⌘+K focuses it. */
export function GlobalSearch({ className, autoFocus, onNavigate }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const flat = groups.flatMap((g) => g.hits);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { groups?: SearchGroup[] };
          setGroups(data.groups ?? []);
          setActive(0);
        }
      } catch {
        // keep the last results
      }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  function open(href: string) {
    setQuery("");
    setGroups([]);
    setFocused(false);
    inputRef.current?.blur();
    router.push(href);
    onNavigate?.();
  }

  function handleInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      inputRef.current?.blur();
      setFocused(false);
    } else if (e.key === "ArrowDown" && flat.length > 0) {
      e.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length > 0) {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      open(flat[active].href);
    }
  }

  const searched = query.trim().length >= 2 && !loading;
  const showDropdown = focused && (flat.length > 0 || searched);
  // Each group's first position in `flat`, so a row knows its keyboard index without a counter.
  const offsets = groups.map((_, gi) => groups.slice(0, gi).reduce((n, g) => n + g.hits.length, 0));

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleInputKey}
          placeholder="Search clients, bookings, invoices…"
          className="pl-9 pr-16"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </div>
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-lg">
          {flat.length === 0 ? (
            <p className="p-3 text-center text-sm text-muted-foreground">Nothing found</p>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              {groups.map((g, gi) => {
                const Icon = GROUP_ICONS[g.key];
                return (
                  <div key={g.key}>
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {g.label}
                    </p>
                    {g.hits.map((hit, hi) => {
                      const i = offsets[gi] + hi;
                      return (
                        <button
                          key={hit.id}
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => open(hit.href)}
                          className={cn(
                            "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                            i === active ? "bg-muted" : "hover:bg-muted",
                          )}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
                            <Icon className="h-3 w-3 text-brand-700 dark:text-brand-300" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{hit.label}</span>
                            {hit.detail && (
                              <span className="block truncate text-xs text-muted-foreground">{hit.detail}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
