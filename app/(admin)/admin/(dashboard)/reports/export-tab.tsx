"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import {
  exportInvoiceRegister,
  exportSessionRegister,
  exportClientList,
} from "./actions";

interface ExportTabProps {
  currentFY: number;
  fyOptions: number[];
}

export function ExportTab({ currentFY, fyOptions }: ExportTabProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fy, setFY] = useState(currentFY);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleExport(
    type: string,
    action: () => Promise<{ csv: string; filename: string } | { error: string }>
  ) {
    setLoading(type);
    try {
      const result = await action();
      if ("error" in result) {
        alert(result.error);
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Date Range Section */}
      <div className="rounded-lg border p-6 space-y-4">
        <h3 className="font-medium">Date Range Exports</h3>
        <p className="text-sm text-muted-foreground">
          Select a date range to export invoices or sessions within that period.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <ExportButton
            label="Invoice Register"
            icon={<FileText className="h-4 w-4" />}
            loading={loading === "invoices"}
            disabled={!from || !to}
            onClick={() =>
              handleExport("invoices", () => exportInvoiceRegister(from, to))
            }
          />
          <ExportButton
            label="Session Register"
            icon={<FileText className="h-4 w-4" />}
            loading={loading === "sessions"}
            disabled={!from || !to}
            onClick={() =>
              handleExport("sessions", () => exportSessionRegister(from, to))
            }
          />
        </div>
      </div>

      {/* FY Section */}
      <div className="rounded-lg border p-6 space-y-4">
        <h3 className="font-medium">Financial Year Exports</h3>
        <p className="text-sm text-muted-foreground">
          Export a full financial year summary (March to February).
        </p>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Financial Year</label>
          <select
            value={fy}
            onChange={(e) => setFY(Number(e.target.value))}
            className="block rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {fyOptions.map((y) => (
              <option key={y} value={y}>
                FY{y} (Mar {y - 1} &ndash; Feb {y})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <ExportButton
            label="FY Invoice Register (CSV)"
            icon={<Download className="h-4 w-4" />}
            loading={loading === "fy-invoices"}
            onClick={() => {
              const fyFrom = `${fy - 1}-03-01`;
              const fyTo = `${fy}-02-28`;
              handleExport("fy-invoices", () =>
                exportInvoiceRegister(fyFrom, fyTo)
              );
            }}
          />
          <ExportButton
            label="FY Session Register (CSV)"
            icon={<Download className="h-4 w-4" />}
            loading={loading === "fy-sessions"}
            onClick={() => {
              const fyFrom = `${fy - 1}-03-01`;
              const fyTo = `${fy}-02-28`;
              handleExport("fy-sessions", () =>
                exportSessionRegister(fyFrom, fyTo)
              );
            }}
          />
        </div>
      </div>

      {/* General Exports */}
      <div className="rounded-lg border p-6 space-y-4">
        <h3 className="font-medium">General Exports</h3>
        <p className="text-sm text-muted-foreground">
          Export a full client list regardless of date range.
        </p>

        <ExportButton
          label="Client List (CSV)"
          icon={<Download className="h-4 w-4" />}
          loading={loading === "clients"}
          onClick={() => handleExport("clients", () => exportClientList())}
        />
      </div>
    </div>
  );
}

function ExportButton({
  label,
  icon,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
