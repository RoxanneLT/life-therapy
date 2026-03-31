"use client";

import { useState, useTransition } from "react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreHorizontal, CheckCircle, Send, Eye } from "lucide-react";
import { markPaymentRequestPaidFromListAction, resendPaymentRequestEmailAction } from "./actions";
import { toast } from "sonner";
import Link from "next/link";

interface PaymentRequestActionsProps {
  readonly requestId: string;
  readonly studentId: string | null;
  readonly clientName: string;
  readonly totalCents: number;
}

export function PaymentRequestActions({
  requestId,
  studentId,
  clientName,
  totalCents,
}: PaymentRequestActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [method, setMethod] = useState("eft");
  const [reference, setReference] = useState("");

  function handleMarkPaid() {
    startTransition(async () => {
      try {
        await markPaymentRequestPaidFromListAction(requestId, method, reference || undefined);
        toast.success(`Payment recorded for ${clientName}`);
        setShowPayDialog(false);
      } catch {
        toast.error("Failed to record payment");
      }
    });
  }

  function handleResend() {
    startTransition(async () => {
      try {
        await resendPaymentRequestEmailAction(requestId);
        toast.success(`Payment request resent to ${clientName}`);
      } catch {
        toast.error("Failed to resend");
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowPayDialog(true)}>
            <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
            Record Payment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleResend}>
            <Send className="mr-2 h-4 w-4" />
            Resend Email
          </DropdownMenuItem>
          {studentId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/admin/clients/${studentId}`}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Client
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payment of R{(totalCents / 100).toFixed(2)} from {clientName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eft">EFT / Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference (optional)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. bank reference number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={isPending}>
              {isPending ? "Recording..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
