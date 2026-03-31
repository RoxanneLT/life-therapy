export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { InvoiceListFilters } from "./invoice-list-filters";
import { InvoiceRowActions } from "./invoice-row-actions";
import { PaymentRequestActions } from "./payment-request-actions";
import { ExportDialog } from "./export-dialog";
import { SortableHeader } from "@/components/admin/sortable-header";
import Link from "next/link";

import { INVOICE_STATUS_BADGE, INVOICE_STATUS_LABEL } from "@/lib/status-styles";

const STATUS_TABS = ["all", "draft", "payment_requested", "paid", "overdue", "cancelled"] as const;

const TYPE_LABELS: Record<string, string> = {
  monthly_postpaid: "Monthly",
  package_purchase: "Package",
  course_purchase: "Course",
  product_sale: "Product",
  ad_hoc_session: "Ad Hoc",
  late_cancel: "Late Cancellation",
  credit_note: "Credit Note",
  other: "Other",
};

const TYPE_COLORS: Record<string, string> = {
  monthly_postpaid: "bg-purple-100 text-purple-700",
  package_purchase: "bg-blue-100 text-blue-700",
  course_purchase: "bg-cyan-100 text-cyan-700",
  product_sale: "bg-orange-100 text-orange-700",
  ad_hoc_session: "bg-indigo-100 text-indigo-700",
  credit_note: "bg-pink-100 text-pink-700",
  other: "bg-gray-100 text-gray-600",
};

type SortField = "invoiceNumber" | "createdAt" | "billingName" | "type" | "totalCents" | "status";
type SortDir = "asc" | "desc";

const VALID_SORT_FIELDS = new Set<SortField>([
  "invoiceNumber", "createdAt", "billingName", "type", "totalCents", "status",
]);

function formatCurrency(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    month?: string;
    q?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  await requireRole("super_admin");

  const params = await searchParams;
  const activeStatus = STATUS_TABS.includes(params.status as (typeof STATUS_TABS)[number])
    ? (params.status as string)
    : "all";
  const activeType = params.type || "";
  const activeMonth = params.month || "";
  const sortField: SortField = VALID_SORT_FIELDS.has(params.sort as SortField)
    ? (params.sort as SortField)
    : "createdAt";
  const sortDir: SortDir = params.dir === "asc" ? "asc" : "desc";

  // Build filter
  const where: Record<string, unknown> = {};
  if (activeStatus !== "all") where.status = activeStatus;
  if (activeType) where.type = activeType;
  if (activeMonth) where.billingMonth = activeMonth;
  if (params.q) {
    where.OR = [
      { billingName: { contains: params.q, mode: "insensitive" } },
      { billingEmail: { contains: params.q, mode: "insensitive" } },
      { invoiceNumber: { contains: params.q, mode: "insensitive" } },
    ];
  }

  // Queries
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // When "payment_requested" tab: show payment requests, not invoices
  const showPaymentRequests = activeStatus === "payment_requested";

  const [invoices, statusCounts, monthStats, pendingRequests, pendingRequestCount] = await Promise.all([
    showPaymentRequests
      ? Promise.resolve([])
      : prisma.invoice.findMany({
          where,
          orderBy: { [sortField]: sortDir },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            billingEntity: { select: { name: true } },
          },
        }),
    prisma.invoice.groupBy({
      by: ["status"],
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { billingMonth: currentMonth },
      _count: true,
      _sum: { totalCents: true },
    }),
    showPaymentRequests
      ? prisma.paymentRequest.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            billingEntity: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    prisma.paymentRequest.count({ where: { status: "pending" } }),
  ]);

  // Status count map (for filter tabs)
  const countMap: Record<string, number> = {};
  let totalCount = 0;
  for (const c of statusCounts) {
    countMap[c.status] = c._count;
    totalCount += c._count;
  }
  // Override payment_requested count with actual pending payment requests
  countMap.payment_requested = pendingRequestCount;
  totalCount += pendingRequestCount;
  countMap.all = totalCount;

  // Look up partial payments on pending PRs
  const prPaidAmounts = new Map<string, number>();
  if (pendingRequests.length > 0) {
    const prIds = pendingRequests.filter(pr => pr.invoiceId).map(pr => pr.invoiceId!);
    if (prIds.length > 0) {
      const partialInvoices = await prisma.invoice.findMany({
        where: { id: { in: prIds } },
        select: { id: true, paidAmountCents: true, paymentRequestId: true },
      });
      for (const inv of partialInvoices) {
        if (inv.paymentRequestId && inv.paidAmountCents) {
          prPaidAmounts.set(inv.paymentRequestId, inv.paidAmountCents);
        }
      }
    }
  }

  // Summary card calculations
  let thisMonthCount = 0;
  let paidThisMonth = 0;
  let outstanding = 0;
  let overdue = 0;

  for (const s of monthStats) {
    thisMonthCount += s._count;
    if (s.status === "paid") paidThisMonth += s._sum.totalCents ?? 0;
    if (s.status === "payment_requested" || s.status === "draft")
      outstanding += s._sum.totalCents ?? 0;
    if (s.status === "overdue") overdue += s._sum.totalCents ?? 0;
  }

  // Add pending payment requests to outstanding
  if (pendingRequestCount > 0) {
    const prTotal = await prisma.paymentRequest.aggregate({
      where: { status: "pending" },
      _sum: { totalCents: true },
    });
    outstanding += prTotal._sum.totalCents ?? 0;
    thisMonthCount += pendingRequestCount;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Invoices"
        description={`${totalCount} total invoices`}
        action={<ExportDialog />}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="This Month" value={String(thisMonthCount)} sub="invoices" />
        <SummaryCard label="Paid This Month" value={formatCurrency(paidThisMonth)} variant="green" />
        <SummaryCard label="Outstanding" value={formatCurrency(outstanding)} variant="yellow" />
        <SummaryCard label="Overdue" value={formatCurrency(overdue)} variant="red" />
      </div>

      {/* Filters */}
      <InvoiceListFilters
        activeStatus={activeStatus}
        search={params.q || ""}
        activeType={activeType}
        activeMonth={activeMonth}
        counts={countMap}
      />

      {/* Table — Payment Requests or Invoices depending on tab */}
      {showPaymentRequests ? (
        pendingRequests.length === 0 ? (
          <EmptyState
            icon={Receipt}
            message="No pending payment requests."
          />
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Date Sent</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRequests.map((pr) => {
                  const clientName = pr.student
                    ? `${pr.student.firstName} ${pr.student.lastName}`
                    : pr.billingEntity?.name ?? "—";
                  const lineItems = pr.lineItems as unknown as { description: string }[];
                  const sessionCount = lineItems?.length ?? 0;
                  const isDue = pr.dueDate && new Date(pr.dueDate) <= now;
                  return (
                    <TableRow key={pr.id}>
                      <TableCell className="text-sm font-medium">
                        {pr.billingMonth}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(pr.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {pr.studentId ? (
                            <Link href={`/admin/clients/${pr.studentId}`} className="hover:text-brand-600 hover:underline">
                              {clientName}
                            </Link>
                          ) : clientName}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sessionCount} session{sessionCount !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-sm font-medium">{formatCurrency(pr.totalCents)}</span>
                        {(prPaidAmounts.get(pr.id) ?? 0) > 0 && (
                          <div className="text-xs text-amber-600">
                            Paid {formatCurrency(prPaidAmounts.get(pr.id)!)} · Due {formatCurrency(pr.totalCents - prPaidAmounts.get(pr.id)!)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={isDue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}>
                          {pr.dueDate ? formatDate(pr.dueDate) : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PaymentRequestActions
                          requestId={pr.id}
                          studentId={pr.studentId}
                          clientName={clientName}
                          totalCents={pr.totalCents}
                          paidCents={prPaidAmounts.get(pr.id) ?? 0}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Total banner */}
            <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {pendingRequests.length} pending request{pendingRequests.length !== 1 ? "s" : ""}
              </span>
              <span className="font-mono text-sm font-bold">
                Total: {formatCurrency(pendingRequests.reduce((s, pr) => s + pr.totalCents, 0))}
              </span>
            </div>
          </div>
        )
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          message={params.q ? "No invoices match your search." : "No invoices found."}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader field="invoiceNumber" label="Invoice #" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead>
                  <SortableHeader field="createdAt" label="Date" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead>
                  <SortableHeader field="billingName" label="Client / Billing" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead>
                  <SortableHeader field="type" label="Type" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead className="text-right">
                  <SortableHeader field="totalCents" label="Amount" currentSort={sortField} currentDir={sortDir} className="justify-end" />
                </TableHead>
                <TableHead>
                  <SortableHeader field="status" label="Status" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const clientName = inv.student
                  ? `${inv.student.firstName} ${inv.student.lastName}`
                  : inv.billingEntity?.name ?? "—";
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-sm">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(inv.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{clientName}</div>
                      {inv.billingName !== clientName && (
                        <div className="text-xs text-muted-foreground">
                          {inv.billingName}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={TYPE_COLORS[inv.type] || ""}
                      >
                        {TYPE_LABELS[inv.type] || inv.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(inv.totalCents)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={INVOICE_STATUS_BADGE[inv.status] || ""}
                      >
                        {INVOICE_STATUS_LABEL[inv.status] || inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <InvoiceRowActions
                        invoiceId={inv.id}
                        status={inv.status}
                        pdfUrl={inv.pdfUrl ? `/api/invoices/download?id=${inv.id}` : null}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  variant,
}: {
  label: string;
  value: string;
  sub?: string;
  variant?: "green" | "yellow" | "red";
}) {
  const colors = {
    green: "border-green-200 bg-green-50",
    yellow: "border-yellow-200 bg-yellow-50",
    red: "border-red-200 bg-red-50",
  };

  return (
    <div className={`rounded-lg border p-4 ${variant ? colors[variant] : ""}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
