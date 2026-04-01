"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Send, Search, X } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import { searchClientsForBillingAction } from "./actions";
import {
  createManualPaymentRequestAction,
  getActiveBillingPresetsAction,
} from "../clients/[id]/actions";

type BillingPreset = Awaited<ReturnType<typeof getActiveBillingPresetsAction>>[number];

// ─── Helpers ─────────────────────────────────────────────────

function formatR(cents: number) {
  return `R ${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function todayPlus7(): string {
  return format(addDays(new Date(), 7), "yyyy-MM-dd");
}

interface LineItem {
  description: string;
  subLine: string;
  quantity: number;
  unitPriceRands: number;
  discountRands: number;
}

function emptyLine(): LineItem {
  return { description: "", subLine: "", quantity: 1, unitPriceRands: 0, discountRands: 0 };
}

function calcTotals(lines: LineItem[], discountPct: number, discountFixedR: number) {
  const subtotal = lines.reduce(
    (s, l) => s + Math.round(l.unitPriceRands * 100) * l.quantity,
    0,
  );
  const lineDiscountTotal = lines.reduce(
    (s, l) => s + Math.round((l.discountRands ?? 0) * 100) * l.quantity,
    0,
  );
  let discountCents: number;
  if (lineDiscountTotal > 0) {
    discountCents = lineDiscountTotal;
  } else {
    const percentDisc = discountPct > 0 ? Math.round((subtotal * discountPct) / 100) : 0;
    const fixedDisc = Math.round(discountFixedR * 100);
    discountCents = Math.max(percentDisc, fixedDisc);
  }
  const afterDiscount = Math.max(0, subtotal - discountCents);
  return { subtotal, discountCents, total: afterDiscount, hasLineDiscounts: lineDiscountTotal > 0 };
}

// ─── Client search result type ────────────────────────────────

interface ClientResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  billingEmail: string | null;
  standingDiscountPercent: number | null;
  standingDiscountFixed: number | null;
}

// ─── Client Picker ────────────────────────────────────────────

function ClientPicker({
  selected,
  onSelect,
}: {
  selected: ClientResult | null;
  onSelect: (c: ClientResult | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchClientsForBillingAction(value);
        setResults(data as ClientResult[]);
        setOpen(true);
      } catch {
        /* non-fatal */
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(c: ClientResult) {
    onSelect(c);
    setQuery(`${c.firstName} ${c.lastName}`);
    setOpen(false);
  }

  function handleClear() {
    onSelect(null);
    setQuery("");
    setResults([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search by name or email…"
          className="h-9 pl-8 pr-8 text-sm"
        />
        {(query || selected) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No clients found</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto py-1">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => handleSelect(c)}
                  >
                    <span className="font-medium">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.billingEmail || c.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main dialog ──────────────────────────────────────────────

export function NewPaymentRequestDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [client, setClient] = useState<ClientResult | null>(null);
  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [discountPct, setDiscountPct] = useState(0);
  const [discountFixedR, setDiscountFixedR] = useState(0);
  const [dueDate, setDueDate] = useState(todayPlus7());
  const [billingMonth, setBillingMonth] = useState("");
  const [note, setNote] = useState("");
  const [confirmAction, setConfirmAction] = useState<"send" | "draft" | null>(null);
  const [presets, setPresets] = useState<BillingPreset[]>([]);

  useEffect(() => {
    if (!open) return;
    getActiveBillingPresetsAction().then(setPresets).catch(() => { /* non-fatal */ });
  }, [open]);

  const totals = calcTotals(lines, discountPct, discountFixedR);

  function handleClientSelect(c: ClientResult | null) {
    setClient(c);
    if (c) {
      setDiscountPct(c.standingDiscountPercent ?? 0);
      setDiscountFixedR((c.standingDiscountFixed ?? 0) / 100);
    }
  }

  function resetForm() {
    setClient(null);
    setLines([emptyLine()]);
    setDiscountPct(0);
    setDiscountFixedR(0);
    setDueDate(todayPlus7());
    setBillingMonth("");
    setNote("");
    setConfirmAction(null);
    setPresets([]);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) resetForm();
  }

  function handleSubmit(sendImmediately: boolean) {
    if (!client) {
      toast.error("Select a client first");
      return;
    }
    if (lines.every((l) => !l.description.trim())) {
      toast.error("Add at least one line item");
      return;
    }
    setConfirmAction(sendImmediately ? "send" : "draft");
  }

  function handleConfirmed() {
    if (!client) return;
    const sendImmediately = confirmAction === "send";
    startTransition(async () => {
      const hasLineDiscounts = totals.hasLineDiscounts;
      const result = await createManualPaymentRequestAction({
        studentId: client.id,
        lineItems: lines.map((l) => ({
          description: l.description,
          subLine: l.subLine || undefined,
          quantity: l.quantity,
          unitPriceCents: Math.round(l.unitPriceRands * 100),
          discountCents: hasLineDiscounts ? Math.round((l.discountRands ?? 0) * 100) : 0,
        })),
        discountPercent: hasLineDiscounts ? undefined : discountPct || undefined,
        discountFixedCents: hasLineDiscounts ? undefined : Math.round(discountFixedR * 100) || undefined,
        dueDate,
        billingMonth: billingMonth || undefined,
        note: note || undefined,
        sendImmediately,
      });

      if (result.success) {
        const billingEmail = client.billingEmail || client.email;
        toast.success(
          sendImmediately
            ? `Payment request sent to ${billingEmail}`
            : "Payment request saved as draft",
        );
        setOpen(false);
      } else {
        toast.error(result.error ?? "Failed to create payment request");
        setConfirmAction(null);
      }
    });
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function addPreset(preset: BillingPreset) {
    setLines((prev) => [
      ...prev.filter((l) => l.description.trim() !== ""),
      {
        description: preset.description,
        subLine: preset.subLine ?? "",
        quantity: 1,
        unitPriceRands: preset.priceCents / 100,
        discountRands: 0,
      },
    ]);
  }

  const clientDisplayEmail = client?.billingEmail || client?.email || "";

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send className="mr-1.5 h-3.5 w-3.5" />
        New Payment Request
      </Button>

      {/* Confirmation */}
      <Dialog
        open={confirmAction !== null}
        onOpenChange={(v) => {
          if (!v) setConfirmAction(null);
        }}
      >
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "send" ? "Send payment request?" : "Save as draft?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction === "send"
              ? `Send payment request of ${formatR(totals.total)} to ${client?.firstName} ${client?.lastName} at ${clientDisplayEmail}?`
              : `Save draft payment request of ${formatR(totals.total)} for ${client?.firstName} ${client?.lastName}?`}
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirmed} disabled={isPending}>
              {isPending
                ? "Processing…"
                : confirmAction === "send"
                  ? "Send"
                  : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>New payment request</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Client picker */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium">Client</Label>
              <ClientPicker selected={client} onSelect={handleClientSelect} />
              {client && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Billing to: {clientDisplayEmail}
                  {(client.standingDiscountPercent ?? 0) > 0 &&
                    ` · ${client.standingDiscountPercent}% standing discount applied`}
                </p>
              )}
            </div>

            {/* Line items */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Line items</Label>

              {/* Column headers */}
              <div className="mb-2 grid grid-cols-[1fr_52px_84px_84px_28px] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span>Discount</span>
                <span />
              </div>

              <div className="space-y-2">
                {lines.map((line, i) => (
                  <div key={i} className="space-y-1">
                    <div className="grid grid-cols-[1fr_52px_84px_84px_28px] items-center gap-2">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLine(i, { description: e.target.value })}
                        placeholder="Description"
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(i, {
                            quantity: Math.max(1, Number.parseInt(e.target.value) || 1),
                          })
                        }
                        className="h-8 text-center text-sm"
                      />
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.unitPriceRands || ""}
                          onChange={(e) =>
                            updateLine(i, {
                              unitPriceRands: Number.parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 pl-5 text-sm"
                        />
                      </div>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          R
                        </span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={line.discountRands || ""}
                          onChange={(e) =>
                            updateLine(i, {
                              discountRands: Number.parseFloat(e.target.value) || 0,
                            })
                          }
                          placeholder="0"
                          className="h-8 pl-5 text-sm"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-600"
                        onClick={() => removeLine(i)}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      value={line.subLine}
                      onChange={(e) => updateLine(i, { subLine: e.target.value })}
                      placeholder="Sub-line (date, note) — optional"
                      className="h-7 text-xs text-muted-foreground"
                    />
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 w-full border border-dashed text-xs text-muted-foreground"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
              >
                <Plus className="mr-1 h-3 w-3" /> Add line
              </Button>

              {presets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <Button
                      key={preset.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => addPreset(preset)}
                    >
                      + {preset.label} ({formatR(preset.priceCents)})
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Discount — invoice-level only when no per-line discounts */}
            {totals.hasLineDiscounts ? (
              <p className="text-xs text-muted-foreground">
                Discount applied per line item · total discount: {formatR(totals.discountCents)}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Discount %
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={discountPct || ""}
                    onChange={(e) => setDiscountPct(Number.parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Fixed discount (R)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={discountFixedR || ""}
                    onChange={(e) => setDiscountFixedR(Number.parseFloat(e.target.value) || 0)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Totals preview */}
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatR(totals.subtotal)}</span>
              </div>
              {totals.discountCents > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatR(totals.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span>{formatR(totals.total)}</span>
              </div>
            </div>

            {/* Due date + billing month */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block text-sm font-medium">Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm font-medium">
                  Billing period{" "}
                  <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  placeholder="e.g. 2026-04"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Note */}
            <div>
              <Label className="mb-1.5 block text-sm font-medium">
                Note{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note appears on the pro-forma PDF"
                className="text-sm"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSubmit(false)}
              disabled={isPending}
            >
              Save Draft
            </Button>
            <Button onClick={() => handleSubmit(true)} disabled={isPending}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Create &amp; Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
