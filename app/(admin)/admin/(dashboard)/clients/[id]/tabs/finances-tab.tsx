"use client";

import { useState, useEffect, useTransition } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Coins,
  Plus,
  Download,
  Send,
  CheckCircle2,
  XCircle,
  Receipt,
  FileText,
  Info,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  grantCreditsAction,
  updateBillingTypeAction,
  updateBillingEmailAction,
  updateStandingDiscountAction,
  markInvoicePaidAction,
  voidInvoiceAction,
  resendInvoiceAction,
  billToDateAction,
  markPaymentRequestPaidAction,
  voidPaymentRequestAction,
  updateBillingAssignmentAction,
  regeneratePaymentLinkAction,
  generateAdHocInvoiceAction,
  getSessionRatesAction,
} from "../actions";
import type { InvoiceLineItem } from "@/lib/billing-types";

// ─── Types ────────────────────────────────────────────────────

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

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  type: string;
  totalCents: number;
  currency: string;
  status: string;
  pdfUrl: string | null;
  createdAt: string;
}

interface PaymentRequestData {
  id: string;
  billingMonth: string;
  totalCents: number;
  currency: string;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface RelationshipOption {
  id: string;
  label: string;
}

interface BilledToMeEntry {
  id: string;
  name: string;
  types: string[];
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

const INVOICE_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700" },
  void: { label: "Void", className: "bg-red-100 text-red-700" },
};

const PR_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Paid", className: "bg-green-100 text-green-700" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700" },
  cancelled: { label: "Voided", className: "bg-red-100 text-red-700" },
};

// ─── Main Component ──────────────────────────────────────────

export function FinancesTab({ client }: FinancesTabProps) {
  const clientId = client.id as string;
  const billingType = (client.billingType as string) || "prepaid";
  const billingEmail = (client.billingEmail as string) || "";
  const standingDiscountPercent = (client.standingDiscountPercent as number) || 0;
  const standingDiscountFixed = (client.standingDiscountFixed as number) || 0;
  const individualBilledToId = (client.individualBilledToId as string | null) ?? null;
  const couplesBilledToId = (client.couplesBilledToId as string | null) ?? null;
  const creditBalance =
    (client.creditBalance as { balance: number } | null)?.balance ?? 0;
  const creditTxns = (client.creditTransactions as CreditTxnData[]) || [];
  const orders = (client.orders as OrderData[]) || [];
  const invoices = (client.invoices as InvoiceData[]) || [];
  const paymentRequests = (client.paymentRequests as PaymentRequestData[]) || [];
  const billedToMe = (client._billedToMe as BilledToMeEntry[]) || [];

  // Build relationship options from BOTH directions + corporate entities
  const relationshipsFrom = (client.relationshipsFrom as {
    id: string;
    relatedStudentId?: string | null;
    relatedStudent?: { firstName: string; lastName: string } | null;
    billingEntityId?: string | null;
    billingEntity?: { name: string } | null;
    relationshipType: string;
  }[]) || [];
  const relationshipsTo = (client.relationshipsTo as {
    id: string;
    student?: { firstName: string; lastName: string } | null;
    relationshipType: string;
  }[]) || [];

  const billingRelationships: RelationshipOption[] = [
    // "From" relationships: this client created them → relatedStudent is the option
    ...relationshipsFrom
      .filter((r) => r.relatedStudentId && r.relatedStudent)
      .map((r) => ({
        id: r.id,
        label: `${r.relatedStudent!.firstName} ${r.relatedStudent!.lastName} (${r.relationshipType})`,
      })),
    // "To" relationships: someone else created them → student is the option
    ...relationshipsTo
      .filter((r) => r.student)
      .map((r) => ({
        id: r.id,
        label: `${r.student!.firstName} ${r.student!.lastName} (${r.relationshipType})`,
      })),
    // Corporate entities from "from" relationships
    ...relationshipsFrom
      .filter((r) => r.billingEntityId && r.billingEntity && !r.relatedStudentId)
      .map((r) => ({
        id: r.id,
        label: `${r.billingEntity!.name} (${r.relationshipType})`,
      })),
  ];

  const isPostpaid = billingType === "postpaid";

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">Finances</h2>

      <Tabs defaultValue="billing">
        <TabsList>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        {/* ── Billing Sub-tab ──────────────────────────────── */}
        <TabsContent value="billing" className="space-y-4">
          {/* Billing Indicator */}
          {billedToMe.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">You receive invoices for:</p>
                <ul className="mt-1 list-inside list-disc">
                  {billedToMe.map((entry) => (
                    <li key={entry.id}>
                      {entry.name} — {entry.types.map((t) => `${t} sessions`).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <BillingConfigCard
            clientId={clientId}
            billingType={billingType}
            billingEmail={billingEmail}
            standingDiscountPercent={standingDiscountPercent}
            standingDiscountFixed={standingDiscountFixed}
            relationships={billingRelationships}
            individualBilledToId={individualBilledToId}
            couplesBilledToId={couplesBilledToId}
          />
        </TabsContent>

        {/* ── Credits Sub-tab ──────────────────────────────── */}
        <TabsContent value="credits" className="space-y-6">
          <div className="flex items-start justify-between">
            <Card className="w-fit">
              <CardContent className="px-8 py-6 text-center">
                <Coins className="mx-auto mb-1 h-6 w-6 text-muted-foreground" />
                <p className="text-3xl font-bold">{creditBalance}</p>
                <p className="text-xs text-muted-foreground">credits</p>
              </CardContent>
            </Card>
            <GrantCreditsDialog clientId={clientId} />
          </div>

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
        </TabsContent>

        {/* ── Invoices Sub-tab ─────────────────────────────── */}
        <TabsContent value="invoices" className="space-y-6">
          <div className="flex justify-end gap-2">
            <CreateInvoiceDialog clientId={clientId} />
            {isPostpaid && <BillToDateButton clientId={clientId} />}
          </div>

          <InvoiceHistorySection invoices={invoices} clientId={clientId} />

          {isPostpaid && (
            <PaymentRequestsSection
              paymentRequests={paymentRequests}
              clientId={clientId}
            />
          )}

          {/* Payment History (Orders) */}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Billing Configuration Card ──────────────────────────────

function BillingConfigCard({
  clientId,
  billingType,
  billingEmail,
  standingDiscountPercent,
  standingDiscountFixed,
  relationships,
  individualBilledToId,
  couplesBilledToId,
}: {
  clientId: string;
  billingType: string;
  billingEmail: string;
  standingDiscountPercent: number;
  standingDiscountFixed: number;
  relationships: RelationshipOption[];
  individualBilledToId: string | null;
  couplesBilledToId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [localEmail, setLocalEmail] = useState(billingEmail);
  const [localPercent, setLocalPercent] = useState(standingDiscountPercent);
  const [localFixed, setLocalFixed] = useState(standingDiscountFixed);
  const [localIndivBilled, setLocalIndivBilled] = useState(individualBilledToId);
  const [localCouplesBilled, setLocalCouplesBilled] = useState(couplesBilledToId);

  function handleBillingTypeChange(checked: boolean) {
    const newType = checked ? "postpaid" : "prepaid";
    startTransition(async () => {
      await updateBillingTypeAction(clientId, newType);
      toast.success(`Billing type set to ${newType}`);
    });
  }

  function handleEmailSave() {
    startTransition(async () => {
      await updateBillingEmailAction(clientId, localEmail);
      toast.success("Billing email updated");
    });
  }

  function handleDiscountSave() {
    startTransition(async () => {
      await updateStandingDiscountAction(
        clientId,
        localPercent || null,
        localFixed || null,
      );
      toast.success("Standing discount updated");
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Receipt className="h-4 w-4" />
          Billing Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Billing Type */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Postpaid Billing</p>
            <p className="text-xs text-muted-foreground">
              {billingType === "postpaid"
                ? "Client is billed monthly for sessions attended"
                : "Client uses prepaid credits (default)"}
            </p>
          </div>
          <Switch
            checked={billingType === "postpaid"}
            onCheckedChange={handleBillingTypeChange}
            disabled={isPending}
          />
        </div>

        {/* Billing Email */}
        <div className="space-y-2">
          <Label className="text-xs">Billing Email Override</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={localEmail}
              onChange={(e) => setLocalEmail(e.target.value)}
              placeholder="Leave empty to use client email"
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleEmailSave}
              disabled={isPending || localEmail === billingEmail}
            >
              Save
            </Button>
          </div>
        </div>

        {/* Standing Discount */}
        <div className="space-y-2">
          <Label className="text-xs">Standing Discount</Label>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={100}
                value={localPercent || ""}
                onChange={(e) => setLocalPercent(Number(e.target.value))}
                placeholder="0"
                className="w-20 text-sm"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">R</span>
              <Input
                type="number"
                min={0}
                value={localFixed ? localFixed / 100 : ""}
                onChange={(e) => setLocalFixed(Math.round(Number(e.target.value) * 100))}
                placeholder="0.00"
                className="w-24 text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscountSave}
              disabled={
                isPending ||
                (localPercent === standingDiscountPercent &&
                  localFixed === standingDiscountFixed)
              }
            >
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Applied automatically when generating invoices. Percentage applied first, then fixed.
          </p>
        </div>

        {/* Session Billing Assignment */}
        {relationships.length > 0 && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Session Billing Assignment
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Individual sessions billed to</Label>
              <Select
                value={localIndivBilled || "self"}
                onValueChange={(v) => {
                  const val = v === "self" ? null : v;
                  setLocalIndivBilled(val);
                  startTransition(async () => {
                    await updateBillingAssignmentAction(clientId, "individual", val);
                    toast.success("Individual billing assignment updated");
                  });
                }}
                disabled={isPending}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self (this client)</SelectItem>
                  {relationships.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Couples sessions billed to</Label>
              <Select
                value={localCouplesBilled || "self"}
                onValueChange={(v) => {
                  const val = v === "self" ? null : v;
                  setLocalCouplesBilled(val);
                  startTransition(async () => {
                    await updateBillingAssignmentAction(clientId, "couples", val);
                    toast.success("Couples billing assignment updated");
                  });
                }}
                disabled={isPending}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Self (this client)</SelectItem>
                  {relationships.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Invoice History ─────────────────────────────────────────

function InvoiceHistorySection({
  invoices,
  clientId,
}: {
  invoices: InvoiceData[];
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleMarkPaid(invoiceId: string) {
    startTransition(async () => {
      await markInvoicePaidAction(invoiceId, "manual", undefined, clientId);
      toast.success("Invoice marked as paid");
    });
  }

  function handleVoid(invoiceId: string) {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    startTransition(async () => {
      await voidInvoiceAction(invoiceId, clientId);
      toast.success("Invoice voided");
    });
  }

  function handleResend(invoiceId: string) {
    startTransition(async () => {
      await resendInvoiceAction(invoiceId);
      toast.success("Invoice resent");
    });
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Invoice History
      </h3>
      {invoices.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5">Number</th>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const statusStyle = INVOICE_STATUS_STYLES[inv.status] || {
                      label: inv.status,
                      className: "bg-gray-100 text-gray-600",
                    };
                    return (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                          {inv.invoiceNumber}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {format(new Date(inv.createdAt), "d MMM yyyy")}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-xs capitalize">
                            {inv.type}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                          {formatCurrency(inv.totalCents, inv.currency)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className={statusStyle.className}>
                            {statusStyle.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            {inv.pdfUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                asChild
                              >
                                <a
                                  href={inv.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Download PDF"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                            {inv.status === "sent" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleResend(inv.id)}
                                  disabled={isPending}
                                  title="Resend"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-green-600"
                                  onClick={() => handleMarkPaid(inv.id)}
                                  disabled={isPending}
                                  title="Mark as Paid"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600"
                                  onClick={() => handleVoid(inv.id)}
                                  disabled={isPending}
                                  title="Void"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
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
        <p className="text-sm text-muted-foreground">No invoices.</p>
      )}
    </section>
  );
}

// ─── Payment Requests ────────────────────────────────────────

function PaymentRequestsSection({
  paymentRequests,
  clientId,
}: {
  paymentRequests: PaymentRequestData[];
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleVoidPR(prId: string) {
    if (!confirm("Void this payment request? Linked sessions will become unbilled and can be re-billed.")) return;
    startTransition(async () => {
      await voidPaymentRequestAction(prId, clientId);
      toast.success("Payment request voided — sessions are now unbilled");
    });
  }

  function handleMarkPaid(prId: string) {
    startTransition(async () => {
      await markPaymentRequestPaidAction(prId, "manual", undefined, clientId);
      toast.success("Payment request marked as paid");
    });
  }

  function handleRegenerateLink(prId: string) {
    startTransition(async () => {
      try {
        const { paymentUrl } = await regeneratePaymentLinkAction(prId, clientId);
        toast.success("Payment link regenerated", {
          description: "New Paystack link created",
          action: {
            label: "Copy",
            onClick: () => navigator.clipboard.writeText(paymentUrl),
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to regenerate link");
      }
    });
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Payment Requests
      </h3>
      {paymentRequests.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5">Period</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Due Date</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRequests.map((pr) => {
                    const statusStyle = PR_STATUS_STYLES[pr.status] || {
                      label: pr.status,
                      className: "bg-gray-100 text-gray-600",
                    };
                    return (
                      <tr key={pr.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 font-medium">
                          {pr.billingMonth}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                          {formatCurrency(pr.totalCents, pr.currency)}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge className={statusStyle.className}>
                            {statusStyle.label}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                          {pr.dueDate
                            ? format(new Date(pr.dueDate), "d MMM yyyy")
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            {pr.status !== "paid" && pr.status !== "cancelled" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRegenerateLink(pr.id)}
                                  disabled={isPending}
                                  title="Regenerate Payment Link"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-green-600"
                                  onClick={() => handleMarkPaid(pr.id)}
                                  disabled={isPending}
                                  title="Mark as Paid"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-red-600"
                                  onClick={() => handleVoidPR(pr.id)}
                                  disabled={isPending}
                                  title="Void"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
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
        <p className="text-sm text-muted-foreground">No payment requests.</p>
      )}
    </section>
  );
}

// ─── Bill to Date Button ─────────────────────────────────────

function BillToDateButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleBillToDate() {
    if (!confirm("Generate a payment request for all unbilled sessions to date?"))
      return;
    startTransition(async () => {
      try {
        await billToDateAction(clientId);
        toast.success("Payment request generated");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to generate payment request",
        );
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleBillToDate} disabled={isPending}>
      <FileText className="mr-2 h-4 w-4" />
      {isPending ? "Generating..." : "Bill to Date"}
    </Button>
  );
}

// ─── Grant Credits Dialog ────────────────────────────────────

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

// ─── Create Invoice Dialog ──────────────────────────────────

interface LineItemDraft {
  description: string;
  quantity: number;
  unitPriceRands: string; // text input, converted to cents on submit
}

function CreateInvoiceDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [method, setMethod] = useState<"eft" | "cash" | "card">("eft");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineItemDraft[]>([
    { description: "", quantity: 1, unitPriceRands: "" },
  ]);
  const [rates, setRates] = useState<{ individualRate: number; couplesRate: number } | null>(null);

  useEffect(() => {
    if (open && !rates) {
      getSessionRatesAction().then(setRates).catch(console.error);
    }
  }, [open, rates]);

  function addBlankLine() {
    setLines((prev) => [...prev, { description: "", quantity: 1, unitPriceRands: "" }]);
  }

  function addSessionLine(type: "individual" | "couples") {
    if (!rates) return;
    const rate = type === "individual" ? rates.individualRate : rates.couplesRate;
    const label = type === "individual" ? "Individual Session" : "Couples Session";
    setLines((prev) => [
      ...prev,
      { description: label, quantity: 1, unitPriceRands: (rate / 100).toFixed(2) },
    ]);
  }

  function updateLine(index: number, field: keyof LineItemDraft, value: string | number) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const validLines = lines.filter((l) => l.description && Number(l.unitPriceRands) > 0);

  function handleCreate() {
    if (validLines.length === 0) return;
    startTransition(async () => {
      try {
        const lineItems: InvoiceLineItem[] = validLines.map((l) => {
          const cents = Math.round(Number(l.unitPriceRands) * 100);
          return {
            description: l.description,
            quantity: l.quantity,
            unitPriceCents: cents,
            discountCents: 0,
            discountPercent: 0,
            totalCents: cents * l.quantity,
          };
        });
        await generateAdHocInvoiceAction({
          studentId: clientId,
          lineItems,
          paymentMethod: method,
          reference: reference || undefined,
        });
        toast.success("Invoice created and sent");
        setOpen(false);
        setLines([{ description: "", quantity: 1, unitPriceRands: "" }]);
        setReference("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create invoice");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Ad-hoc Invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Quick-add session buttons */}
          {rates && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSessionLine("individual")}
              >
                + Individual (R{(rates.individualRate / 100).toFixed(0)})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSessionLine("couples")}
              >
                + Couples (R{(rates.couplesRate / 100).toFixed(0)})
              </Button>
            </div>
          )}

          {/* Line items */}
          <div className="space-y-3">
            <Label className="text-xs">Line Items</Label>
            {lines.map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Qty</span>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(i, "quantity", Number(e.target.value))}
                        className="w-16 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">R</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitPriceRands}
                        onChange={(e) => updateLine(i, "unitPriceRands", e.target.value)}
                        placeholder="0.00"
                        className="w-28 text-sm"
                      />
                    </div>
                  </div>
                </div>
                {lines.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-1 h-7 w-7 text-red-500"
                    onClick={() => removeLine(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={addBlankLine}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add line
            </Button>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label className="text-xs">Payment Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as "eft" | "cash" | "card")}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eft">EFT</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label className="text-xs">Reference (optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. EFT reference number"
              className="text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>Cancel</Button>
          </DialogClose>
          <Button onClick={handleCreate} disabled={isPending || validLines.length === 0}>
            {isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
