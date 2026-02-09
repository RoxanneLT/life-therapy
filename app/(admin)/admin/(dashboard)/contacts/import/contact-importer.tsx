"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { importContactsAction } from "../actions";
import { toast } from "sonner";
import { Upload, CheckCircle } from "lucide-react";

const FIELD_OPTIONS = [
  { value: "", label: "— Skip —" },
  { value: "email", label: "Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "phone", label: "Phone" },
  { value: "gender", label: "Gender" },
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && next === "\n")) {
        row.push(current.trim());
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        current = "";
        if (char === "\r") i++;
      } else {
        current += char;
      }
    }
  }

  // Last row
  row.push(current.trim());
  if (row.some((cell) => cell !== "")) rows.push(row);

  return rows;
}

export function ContactImporter() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [consentGiven, setConsentGiven] = useState(false);
  const [skipDrip, setSkipDrip] = useState(false);
  const [tags, setTags] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; total: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast.error("CSV must have at least a header row and one data row.");
        return;
      }

      const csvHeaders = parsed[0];
      const csvRows = parsed.slice(1);
      setHeaders(csvHeaders);
      setRows(csvRows);
      setResult(null);

      // Auto-map common header names
      const autoMapping: Record<number, string> = {};
      csvHeaders.forEach((h, i) => {
        const lower = h.toLowerCase().trim();
        if (lower === "email" || lower === "e-mail" || lower === "email address") {
          autoMapping[i] = "email";
        } else if (lower === "first name" || lower === "firstname" || lower === "first" || lower === "fname") {
          autoMapping[i] = "firstName";
        } else if (lower === "last name" || lower === "lastname" || lower === "last" || lower === "lname" || lower === "surname") {
          autoMapping[i] = "lastName";
        } else if (lower === "phone" || lower === "telephone" || lower === "tel" || lower === "mobile") {
          autoMapping[i] = "phone";
        } else if (lower === "gender" || lower === "sex") {
          autoMapping[i] = "gender";
        }
      });
      setMapping(autoMapping);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    // Validate email mapping exists
    const emailCol = Object.entries(mapping).find(([, v]) => v === "email");
    if (!emailCol) {
      toast.error("You must map at least one column to Email.");
      return;
    }

    setImporting(true);
    try {
      const mappedRows = rows.map((row) => {
        const obj: Record<string, string> = {};
        Object.entries(mapping).forEach(([colIdx, field]) => {
          if (field && row[Number(colIdx)]) {
            obj[field] = row[Number(colIdx)];
          }
        });
        return obj;
      });

      const tagsList = tags.split(",").map((t) => t.trim()).filter(Boolean);
      const res = await importContactsAction(
        mappedRows as { email: string; firstName?: string; lastName?: string; phone?: string; gender?: string }[],
        { consentGiven, skipDrip, tags: tagsList }
      );

      setResult(res);
      toast.success(`Import complete: ${res.created} created, ${res.updated} updated`);
    } catch (err) {
      toast.error("Import failed. Please try again.");
      console.error(err);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Upload CSV File</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="max-w-sm"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            CSV file with headers. Common formats from Mailchimp, Google Contacts, etc. are supported.
          </p>
        </CardContent>
      </Card>

      {/* Step 2: Map Fields */}
      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Map Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {headers.map((header, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-40 truncate text-sm font-medium">{header}</span>
                  <span className="text-muted-foreground">&rarr;</span>
                  <select
                    value={mapping[i] || ""}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [i]: e.target.value }))
                    }
                    className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {FIELD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Preview ({rows.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {headers.map((h, i) => (
                      <th key={i} className="px-2 py-1 text-left font-medium">
                        {h}
                        {mapping[i] && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {mapping[i]}
                          </Badge>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-t">
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2 py-1 text-muted-foreground">
                          {cell || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing first 5 of {rows.length} rows
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Options & Import */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Import Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="consentGiven"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="consentGiven" className="text-sm font-normal">
                Mark all imported contacts as consented (only if they previously opted in)
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="skipDrip"
                checked={skipDrip}
                onChange={(e) => setSkipDrip(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="skipDrip" className="text-sm font-normal">
                Skip drip sequence (existing clients — campaign only)
              </Label>
            </div>

            <div>
              <Label htmlFor="tags">Apply tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. mailchimp-import, 2026"
                className="max-w-sm"
              />
            </div>

            <Button onClick={handleImport} disabled={importing}>
              <Upload className="mr-2 h-4 w-4" />
              {importing ? "Importing..." : `Import ${rows.length} Contacts`}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <CheckCircle className="mt-0.5 h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Import Complete</p>
              <p className="text-sm text-green-700">
                {result.created} created &middot; {result.updated} updated &middot; {result.skipped} skipped &middot; {result.total} total
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
