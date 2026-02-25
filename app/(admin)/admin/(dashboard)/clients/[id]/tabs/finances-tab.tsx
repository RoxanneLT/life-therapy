"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Coins, Plus } from "lucide-react";
import { format } from "date-fns";
import { grantCreditsAction } from "../actions";

interface CreditTxnData {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface OrderData {
  id: string;
  orderNumber: string;
  totalCents: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

interface FinancesTabProps {
  client: Record<string, unknown>;
}

const TXN_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  purchase: { label: "Purchase", className: "bg-green-100 text-green-700" },
  used: { label: "Used", className: "bg-blue-100 text-blue-700" },
  refund: { label: "Refund", className: "bg-green-100 text-green-700" },
  admin_grant: { label: "Granted", className: "bg-green-100 text-green-700" },
  gift_received: { label: "Gift", className: "bg-purple-100 text-purple-700" },
};

function getTxnStyle(type: string, description: string) {
  const lower = description.toLowerCase();
  if (
    lower.includes("forfeit") ||
    lower.includes("late cancel") ||
    lower.includes("no-show")
  ) {
    return { label: "Forfeit", className: "bg-red-100 text-red-700" };
  }
  return TXN_TYPE_STYLES[type] || { label: type, className: "bg-gray-100 text-gray-600" };
}

function formatCurrency(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbols: Record<string, string> = {
    ZAR: "R",
    USD: "$",
    EUR: "\u20AC",
    GBP: "\u00A3",
  };
  const symbol = symbols[currency] || currency + " ";
  return `${symbol}${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export function FinancesTab({ client }: FinancesTabProps) {
  const clientId = client.id as string;
  const creditBalance =
    (client.creditBalance as { balance: number } | null)?.balance ?? 0;
  const creditTxns = (client.creditTransactions as CreditTxnData[]) || [];
  const orders = (client.orders as OrderData[]) || [];

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-lg font-semibold">Finances</h2>

      {/* Credit Balance */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Credit Balance
        </h3>
        <Card className="w-fit">
          <CardContent className="px-8 py-6 text-center">
            <Coins className="mx-auto mb-1 h-6 w-6 text-muted-foreground" />
            <p className="text-3xl font-bold">{creditBalance}</p>
            <p className="text-xs text-muted-foreground">credits</p>
          </CardContent>
        </Card>
      </section>

      {/* Transaction History */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Transaction History
        </h3>
        {creditTxns.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                      <th className="px-4 py-2.5 text-right">Balance</th>
                      <th className="px-4 py-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditTxns.map((txn) => {
                      const style = getTxnStyle(txn.type, txn.description);
                      return (
                        <tr key={txn.id} className="border-b last:border-0">
                          <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                            {format(new Date(txn.createdAt), "d MMM yyyy")}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant="secondary"
                              className={style.className}
                            >
                              {style.label}
                            </Badge>
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-2.5 text-right font-medium ${txn.amount > 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {txn.amount > 0 ? "+" : ""}
                            {txn.amount}
                          </td>
                          <td className="whitespace-nowrap px-4 py-2.5 text-right text-muted-foreground">
                            {txn.balanceAfter}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {txn.description}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No transactions.</p>
        )}
      </section>

      {/* Payment History */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Payment History
        </h3>
        {orders.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {format(
                            new Date(order.paidAt || order.createdAt),
                            "d MMM yyyy",
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                          {formatCurrency(order.totalCents, order.currency)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className="bg-green-100 text-green-700">
                            Paid
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {order.orderNumber}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No payments.</p>
        )}
      </section>

      {/* Actions */}
      <GrantCreditsDialog clientId={clientId} />
    </div>
  );
}

function GrantCreditsDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleGrant() {
    startTransition(async () => {
      await grantCreditsAction(clientId, amount, reason);
      setOpen(false);
      setAmount(1);
      setReason("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Grant Credits
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Grant Session Credits</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Credits to grant (1-20)</Label>
            <Input
              type="number"
              min={1}
              max={20}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Compensation for cancelled session"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleGrant}
            disabled={isPending || amount < 1 || amount > 20}
          >
            {isPending ? "Granting..." : `Grant ${amount} Credit${amount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
