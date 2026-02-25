"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoreHorizontal, CheckCircle, XCircle, Send, Download, Loader2 } from "lucide-react";
import {
  markInvoicePaidFromListAction,
  voidInvoiceFromListAction,
  resendInvoiceFromListAction,
} from "./actions";

interface InvoiceRowActionsProps {
  readonly invoiceId: string;
  readonly status: string;
  readonly pdfUrl: string | null;
}

export function InvoiceRowActions({ invoiceId, status, pdfUrl }: InvoiceRowActionsProps) {
  const [markPaidOpen, setMarkPaidOpen] = useState(false);
  const [method, setMethod] = useState("eft");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const canMarkPaid = status === "draft" || status === "payment_requested" || status === "overdue";
  const canVoid = status !== "paid" && status !== "cancelled";
  const canResend = status === "payment_requested" || status === "overdue";

  async function handleMarkPaid() {
    setLoading(true);
    try {
      await markInvoicePaidFromListAction(invoiceId, method, reference || undefined);
      setMarkPaidOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleVoid() {
    if (!confirm("Void this invoice? This will unlink any associated bookings.")) return;
    setLoading(true);
    try {
      await voidInvoiceFromListAction(invoiceId);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    try {
      await resendInvoiceFromListAction(invoiceId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canMarkPaid && (
            <DropdownMenuItem onClick={() => setMarkPaidOpen(true)}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark as Paid
            </DropdownMenuItem>
          )}
          {canResend && (
            <DropdownMenuItem onClick={handleResend} disabled={loading}>
              <Send className="mr-2 h-4 w-4" />
              Resend
            </DropdownMenuItem>
          )}
          {pdfUrl && (
            <DropdownMenuItem asChild>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </a>
            </DropdownMenuItem>
          )}
          {canVoid && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleVoid}
                disabled={loading}
                className="text-red-600 focus:text-red-600"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Void
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Mark as Paid dialog */}
      <Dialog open={markPaidOpen} onOpenChange={setMarkPaidOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="eft">EFT / Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="paystack">Paystack</option>
              </select>
            </div>

            {method === "eft" && (
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Reference (optional)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Bank reference"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}

            <Button
              onClick={handleMarkPaid}
              disabled={loading}
              className="w-full"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
