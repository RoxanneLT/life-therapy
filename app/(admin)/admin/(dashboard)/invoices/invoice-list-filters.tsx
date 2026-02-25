"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "payment_requested", label: "Requested" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "monthly_postpaid", label: "Monthly Postpaid" },
  { value: "package_purchase", label: "Package" },
  { value: "course_purchase", label: "Course" },
  { value: "product_sale", label: "Product" },
  { value: "ad_hoc_session", label: "Ad Hoc" },
  { value: "credit_note", label: "Credit Note" },
  { value: "other", label: "Other" },
] as const;

interface InvoiceListFiltersProps {
  readonly activeStatus: string;
  readonly search: string;
  readonly activeType: string;
  readonly activeMonth: string;
  readonly counts: Record<string, number>;
}

export function InvoiceListFilters({
  activeStatus,
  search,
  activeType,
  activeMonth,
  counts,
}: InvoiceListFiltersProps) {
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
      // Reset sort when changing filters
      router.push(`/admin/invoices?${sp.toString()}`);
    },
    [router, searchParams],
  );

  function handleTabClick(tab: string) {
    navigate({ status: tab === "all" ? undefined : tab, q: undefined });
    setQuery("");
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ q: query.trim() || undefined });
  }

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeStatus === tab.key
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

      {/* Second row: type dropdown + month picker + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={activeType}
          onChange={(e) => navigate({ type: e.target.value || undefined })}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={activeMonth}
          onChange={(e) => navigate({ month: e.target.value || undefined })}
          className="h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <form onSubmit={handleSearch} className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-64"
          />
        </form>
      </div>
    </div>
  );
}
