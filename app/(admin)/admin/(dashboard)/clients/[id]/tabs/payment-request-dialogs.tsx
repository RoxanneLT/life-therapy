"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
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
import { Send, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import {
  getActiveBillingPresetsAction,
  createManualPaymentRequestAction,
  getPaymentRequestDetailsAction,
  updatePaymentRequestAction,
  resendPaymentRequestAction,
} from "../actions";

type BillingPreset = Awaited<ReturnType<typeof getActiveBillingPresetsAction>>[number];

// ─── Helpers ─────────────────────────────────────────────────

function formatR(cents: number) {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayPlus7(): string {
  return format(addDays(new Date(), 7), "yyyy-MM-dd");
}

interface LineItem {
  description: string;
  subLine: string;
  quantity: number;
  unitPriceRands: number;
  discountRands: number; // per-line discount; aggregates to invoice discount when > 0
}

function emptyLine(): LineItem {
  return { description: "", subLine: "", quantity: 1, unitPriceRands: 0, discountRands: 0 };
}

function calcTotals(
  lines: LineItem[],
  discountPct: number,
  discountFixedR: number,
  vatPct: number,
) {
  const subtotal = lines.reduce((s, l) => s + Math.round(l.unitPriceRands * 100) * l.quantity, 0);
  const lineDiscountTotal = lines.reduce((s, l) => s + Math.round((l.discountRands ?? 0) * 100) * l.quantity, 0);
  let discountCents: number;
  if (lineDiscountTotal > 0) {
    discountCents = lineDiscountTotal;
  } else {
    const percentDisc = discountPct > 0 ? Math.round((subtotal * discountPct) / 100) : 0;
    const fixedDisc = Math.round(discountFixedR * 100);
    discountCents = Math.max(percentDisc, fixedDisc);
  }
  const afterDiscount = Math.max(0, subtotal - discountCents);
  const vatCents = vatPct > 0 ? Math.round((afterDiscount * vatPct) / 100) : 0;
  const total = afterDiscount + vatCents;
  return { subtotal, discountCents, vatCents, total, hasLineDiscounts: lineDiscountTotal > 0 };
}

// ─── Line items editor (shared) ──────────────────────────────

interface LineEditorProps {
  lines: LineItem[];
  onLinesChange: (lines: LineItem[]) => void;
  presets: BillingPreset[];
  loadingPresets: boolean;
}

function LineEditor({ lines, onLinesChange, presets, loadingPresets }: LineEditorProps) {
  function updateLine(i: number, patch: Partial<LineItem>) {
    const next = lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
    onLinesChange(next);
  }
  function removeLine(i: number) {
    onLinesChange(lines.filter((_, idx) => idx !== i));
  }
  function addLine() {
    onLinesChange([...lines, emptyLine()]);
  }
  function addPreset(preset: BillingPreset) {
    onLinesChange([
      ...lines,
      {
        description: preset.description,
        subLine: preset.subLine ?? "",
        quantity: 1,
        unitPriceRands: preset.priceCents / 100,
        discountRands: 0,
      },
    ]);
  }

  return (
    <div className="space-y-3">
      {/* Quick-add preset buttons */}
      <div className="flex flex-wrap gap-2">
        {loadingPresets ? (
          <>
            <div className="h-7 w-32 animate-pulse rounded bg-muted" />
            <div className="h-7 w-32 animate-pulse rounded bg-muted" />
          </>
        ) : presets.length > 0 ? (
          presets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 border-dashed text-xs"
              onClick={() => addPreset(preset)}
            >
              <Plus className="mr-1 h-3 w-3" />
              {preset.label} ({formatR(preset.priceCents)})
            </Button>
          ))
        ) : null}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_52px_84px_84px_28px] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span>Discount</span>
        <span />
      </div>

      {/* Lines */}
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
              onChange={(e) => updateLine(i, { quantity: Math.max(1, Number.parseInt(e.target.value) || 1) })}
              className="h-8 text-center text-sm"
            />
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={line.unitPriceRands || ""}
                onChange={(e) => updateLine(i, { unitPriceRands: Number.parseFloat(e.target.value) || 0 })}
                className="h-8 pl-5 text-sm"
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={line.discountRands || ""}
                onChange={(e) => updateLine(i, { discountRands: Number.parseFloat(e.target.value) || 0 })}
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

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-full border border-dashed text-xs text-muted-foreground"
        onClick={addLine}
      >
        <Plus className="mr-1 h-3 w-3" /> Add line
      </Button>
    </div>
  );
}

// ─── Totals display (shared) ──────────────────────────────────

function TotalsDisplay({
  subtotal, discountCents, vatCents, total,
}: { subtotal: number; discountCents: number; vatCents: number; total: number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm space-y-1.5">
      <div className="flex justify-between text-muted-foreground">
        <span>Subtotal</span><span>{formatR(subtotal)}</span>
      </div>
      {discountCents > 0 && (
        <div className="flex justify-between text-green-600">
          <span>Discount</span><span>-{formatR(discountCents)}</span>
        </div>
      )}
      {vatCents > 0 && (
        <div className="flex justify-between text-muted-foreground">
          <span>VAT</span><span>{formatR(vatCents)}</span>
        </div>
      )}
      <div className="flex justify-between border-t pt-2 font-semibold">
        <span>Total</span><span>{formatR(total)}</span>
      </div>
    </div>
  );
}

// ─── Create Payment Request Dialog ───────────────────────────

interface CreatePaymentRequestDialogProps {
  readonly clientId: string;
  readonly clientName: string;
  readonly billingEmail: string;
  readonly standingDiscountPercent: number;
  readonly standingDiscountFixed: number;
}

export function CreatePaymentRequestDialog({
  clientId,
  clientName,
  billingEmail,
  standingDiscountPercent,
  standingDiscountFixed,
}: CreatePaymentRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [discountPct, setDiscountPct] = useState(standingDiscountPercent);
  const [discountFixedR, setDiscountFixedR] = useState(standingDiscountFixed / 100);
  const [dueDate, setDueDate] = useState(todayPlus7());
  const [billingMonth, setBillingMonth] = useState("");
  const [note, setNote] = useState("");
  const [presets, setPresets] = useState<BillingPreset[]>([]);
  const [loadingPresets, setLoadingPresets] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"send" | "draft" | null>(null);

  const vatPct = 0; // client-side preview — server does authoritative calc with site settings

  const totals = calcTotals(lines, discountPct, discountFixedR, vatPct);

  const loadPresets = useCallback(async () => {
    setLoadingPresets(true);
    try {
      const data = await getActiveBillingPresetsAction();
      setPresets(data);
    } catch { /* non-fatal */ }
    finally { setLoadingPresets(false); }
  }, []);

  useEffect(() => {
    if (open) void loadPresets();
  }, [open, loadPresets]);

  function resetForm() {
    setLines([emptyLine()]);
    setDiscountPct(standingDiscountPercent);
    setDiscountFixedR(standingDiscountFixed / 100);
    setDueDate(todayPlus7());
    setBillingMonth("");
    setNote("");
    setConfirmAction(null);
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) resetForm();
  }

  function handleSubmit(sendImmediately: boolean) {
    if (lines.every((l) => !l.description.trim())) {
      toast.error("Add at least one line item");
      return;
    }
    setConfirmAction(sendImmediately ? "send" : "draft");
  }

  function handleConfirmed() {
    const sendImmediately = confirmAction === "send";
    startTransition(async () => {
      const hasLineDiscounts = totals.hasLineDiscounts;
      const result = await createManualPaymentRequestAction({
        studentId: clientId,
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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Send className="mr-1.5 h-3.5 w-3.5" />
        Payment Request
      </Button>

      {/* Confirmation dialog */}
      <Dialog open={confirmAction !== null} onOpenChange={(v) => { if (!v) setConfirmAction(null); }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "send" ? "Send payment request?" : "Save as draft?"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {confirmAction === "send"
              ? `This will email a payment request of ${formatR(totals.total)} to ${clientName} at ${billingEmail} with a pro-forma invoice attached.`
              : `The payment request of ${formatR(totals.total)} will be saved as a draft. You can send it later.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleConfirmed} disabled={isPending}>
              {isPending ? "Processing..." : confirmAction === "send" ? "Send" : "Save Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main dialog */}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>New payment request — {clientName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Line items */}
            <div>
              <Label className="mb-2 block text-sm font-medium">Line items</Label>
              <LineEditor
                lines={lines}
                onLinesChange={setLines}
                presets={presets}
                loadingPresets={loadingPresets}
              />
            </div>

            {/* Discount — invoice-level only shown when no per-line discounts */}
            {totals.hasLineDiscounts ? (
              <p className="text-xs text-muted-foreground">
                Discount applied per line item · total discount: {formatR(totals.discountCents)}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Discount %</Label>
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
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Fixed discount (R)</Label>
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

            {/* Totals */}
            <TotalsDisplay {...totals} />

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
                <Label className="mb-1.5 block text-sm font-medium">Billing period <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
              <Label className="mb-1.5 block text-sm font-medium">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
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
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button variant="outline" onClick={() => handleSubmit(false)} disabled={isPending}>
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

// ─── Edit Payment Request Dialog ──────────────────────────────

interface EditPaymentRequestDialogProps {
  readonly paymentRequestId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly billingEmail: string;
}

export function EditPaymentRequestDialog({
  paymentRequestId,
  clientId,
  clientName,
  billingEmail,
}: EditPaymentRequestDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);
  const [discountPct, setDiscountPct] = useState(0);
  const [discountFixedR, setDiscountFixedR] = useState(0);
  const [dueDate, setDueDate] = useState(todayPlus7());
  const [presets, setPresets] = useState<BillingPreset[]>([]);
  const [confirmResend, setConfirmResend] = useState(false);

  // loading: true while dialog is open and presets haven't arrived yet
  const loading = open && presets.length === 0;

  const vatPct = 0;
  const totals = calcTotals(lines, discountPct, discountFixedR, vatPct);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function load() {
      try {
        const [pr, data] = await Promise.all([
          getPaymentRequestDetailsAction(paymentRequestId),
          getActiveBillingPresetsAction(),
        ]);
        if (cancelled) return;
        if (pr) {
          setLines(
            pr.lineItems.length > 0
              ? pr.lineItems.map((li) => ({
                  description: li.description,
                  subLine: li.subLine ?? "",
                  quantity: li.quantity,
                  unitPriceRands: li.unitPriceCents / 100,
                  discountRands: (li.discountCents ?? 0) / 100,
                }))
              : [emptyLine()],
          );
          setDueDate(pr.dueDate ? format(new Date(pr.dueDate), "yyyy-MM-dd") : todayPlus7());
          if (pr.discountCents > 0 && pr.subtotalCents > 0) {
            setDiscountPct(Math.round((pr.discountCents / pr.subtotalCents) * 100));
          }
        }
        setPresets(data);
      } catch {
        if (cancelled) return;
        toast.error("Failed to load payment request");
        setOpen(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [open, paymentRequestId]);

  function handleSave(resend: boolean) {
    if (lines.every((l) => !l.description.trim())) {
      toast.error("Add at least one line item");
      return;
    }
    if (resend) {
      setConfirmResend(true);
      return;
    }
    submitSave(false);
  }

  function submitSave(resend: boolean) {
    startTransition(async () => {
      const hasLineDiscounts = totals.hasLineDiscounts;
      const result = await updatePaymentRequestAction({
        paymentRequestId,
        studentId: clientId,
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
        resend,
      });

      if (result.success) {
        toast.success(resend ? `Payment request resent to ${billingEmail}` : "Payment request updated");
        setOpen(false);
        setConfirmResend(false);
      } else {
        toast.error(result.error ?? "Failed to update");
        setConfirmResend(false);
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        title="Edit payment request"
        onClick={() => setOpen(true)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>

      {/* Resend confirmation */}
      <Dialog open={confirmResend} onOpenChange={(v) => { if (!v) setConfirmResend(false); }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Save &amp; resend?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will resend the updated payment request of {formatR(totals.total)} to {clientName} at {billingEmail}. The previous version will be superseded.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResend(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={() => submitSave(true)} disabled={isPending}>
              {isPending ? "Sending..." : "Save & Resend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main edit dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPresets([]); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Edit payment request — {clientName}</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="space-y-3 py-4">
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
              <div className="h-8 w-full animate-pulse rounded bg-muted" />
              <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <div className="space-y-5 py-1">
              <div>
                <Label className="mb-2 block text-sm font-medium">Line items</Label>
                <LineEditor
                  lines={lines}
                  onLinesChange={setLines}
                  presets={presets}
                  loadingPresets={loading}
                />
              </div>

              {totals.hasLineDiscounts ? (
                <p className="text-xs text-muted-foreground">
                  Discount applied per line item · total discount: {formatR(totals.discountCents)}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Discount %</Label>
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
                    <Label className="mb-1.5 block text-xs text-muted-foreground">Fixed discount (R)</Label>
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

              <TotalsDisplay {...totals} />

              <div>
                <Label className="mb-1.5 block text-sm font-medium">Due date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending || loading}>Cancel</Button>
            <Button variant="outline" onClick={() => handleSave(false)} disabled={isPending || loading}>Save</Button>
            <Button onClick={() => handleSave(true)} disabled={isPending || loading}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Save &amp; Resend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Resend / Send button ─────────────────────────────────────

interface ResendPRButtonProps {
  readonly paymentRequestId: string;
  readonly clientId: string;
  readonly clientName: string;
  readonly billingEmail: string;
  readonly totalCents: number;
  readonly isDraft: boolean;
}

export function ResendPRButton({
  paymentRequestId,
  clientId,
  clientName,
  billingEmail,
  totalCents,
  isDraft,
}: ResendPRButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  function handleConfirmed() {
    startTransition(async () => {
      try {
        const result = await resendPaymentRequestAction(paymentRequestId, clientId);
        if (result.success) {
          toast.success(`Payment request sent to ${billingEmail}`);
        } else {
          toast.error(result.error ?? "Failed to send");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send payment request");
      }
      setConfirm(false);
    });
  }

  return (
    <>
      <Dialog open={confirm} onOpenChange={(v) => { if (!v) setConfirm(false); }}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{isDraft ? "Send payment request?" : "Resend payment request?"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isDraft
              ? `Send payment request of ${formatR(totalCents)} to ${clientName} at ${billingEmail}?`
              : `Resend payment request of ${formatR(totalCents)} to ${clientName} at ${billingEmail}?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleConfirmed} disabled={isPending}>
              {isPending ? "Sending..." : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button
        variant={isDraft ? "default" : "ghost"}
        size="icon"
        className={isDraft ? "h-7 w-7" : "h-7 w-7"}
        title={isDraft ? "Send payment request" : "Resend payment request"}
        onClick={() => setConfirm(true)}
        disabled={isPending}
      >
        <Send className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}
