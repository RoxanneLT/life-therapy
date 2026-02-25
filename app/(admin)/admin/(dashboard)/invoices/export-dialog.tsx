"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Loader2 } from "lucide-react";
import { exportInvoicesCsvAction } from "./actions";

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

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "payment_requested", label: "Payment Requested" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function getFinancialYears() {
  const now = new Date();
  const currentFY = now.getMonth() >= 2 ? now.getFullYear() + 1 : now.getFullYear();
  return [currentFY, currentFY - 1, currentFY - 2];
}

export function ExportDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"fy" | "custom">("fy");
  const [fy, setFy] = useState(String(getFinancialYears()[0]));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const filters = {
        ...(mode === "fy"
          ? { financialYear: fy }
          : { startDate: startDate || undefined, endDate: endDate || undefined }),
        type: type || undefined,
        status: status || undefined,
      };

      const csv = await exportInvoicesCsvAction(filters);

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoices-export-${mode === "fy" ? `FY${fy}` : "custom"}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Invoices</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Date range mode */}
          <div className="flex gap-2 rounded-lg bg-muted p-1">
            <button
              onClick={() => setMode("fy")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "fy"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Financial Year
            </button>
            <button
              onClick={() => setMode("custom")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "custom"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Custom Range
            </button>
          </div>

          {mode === "fy" ? (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Financial Year
              </label>
              <select
                value={fy}
                onChange={(e) => setFy(e.target.value)}
                className={inputClass}
              >
                {getFinancialYears().map((year) => (
                  <option key={year} value={String(year)}>
                    FY{year} (Mar {year - 1} – Feb {year})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* Type filter */}
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className={inputClass}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleExport} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
