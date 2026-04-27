export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { BookingStatus } from "@/lib/generated/prisma/client";
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
import { NewPaymentRequestDialog } from "./new-pr-dialog";
import { SortableHeader } from "@/components/admin/sortable-header";
import Link from "next/link";

import { INVOICE_STATUS_BADGE, INVOICE_STATUS_LABEL } from "@/lib/status-styles";
import { getBillingPeriod } from "@/lib/billing";
import { UpcomingBillingSection, type UpcomingBooking } from "./upcoming-billing-section";

const STATUS_TABS = ["all", "upcoming", "payment_requested", "paid", "overdue", "cancelled"] as const;

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
  if (activeStatus !== "all" && activeStatus !== "upcoming") where.status = activeStatus;
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

  // Billing period for upcoming run tab
  const { start: billingPeriodStart, end: billingPeriodEnd } = getBillingPeriod(
    now.getFullYear(),
    now.getMonth() + 1,
  );
  const unbilledWhere = {
    student: { billingType: "postpaid" },
    OR: [
      { status: { in: [BookingStatus.completed, BookingStatus.no_show] } },
      { status: BookingStatus.cancelled, isLateCancel: true },
    ],
    date: { gte: billingPeriodStart, lte: billingPeriodEnd },
    paymentRequestId: null,
    invoiceId: null,
  };

  // When "payment_requested" tab: show payment requests, not invoices
  const showPaymentRequests = activeStatus === "payment_requested";
  const showUpcoming = activeStatus === "upcoming";

  // Find the most recent billing month across invoices
  const lastCycleInvoice = await prisma.invoice.findFirst({
    where: { billingMonth: { not: null } },
    orderBy: { billingMonth: "desc" },
    select: { billingMonth: true },
  });
  const lastCycleBillingMonth = lastCycleInvoice?.billingMonth ?? null;

  const [invoices, statusCounts, lastCycleStats, overdueResult, pendingRequests, pendingRequestCount, upcomingCount] = await Promise.all([
    (showPaymentRequests || showUpcoming)
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
    // Last cycle stats grouped by status
    lastCycleBillingMonth
      ? prisma.invoice.groupBy({
          by: ["status"],
          where: { billingMonth: lastCycleBillingMonth },
          _count: true,
          _sum: { totalCents: true },
        })
      : Promise.resolve([]),
    // Overdue: all overdue invoices across all months
    prisma.invoice.aggregate({
      where: { status: "overdue" },
      _sum: { totalCents: true },
    }),
    showPaymentRequests
      ? prisma.paymentRequest.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          include: {
            student: { select: { id: true, firstName: true, lastName: true, email: true, billingEmail: true } },
            billingEntity: { select: { name: true, email: true } },
          },
        })
      : Promise.resolve([]),
    prisma.paymentRequest.count({ where: { status: "pending" } }),
    prisma.booking.count({ where: unbilledWhere }),
  ]);

  const upcomingBookingsRaw = showUpcoming
    ? await prisma.booking.findMany({
        where: unbilledWhere,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              standingDiscountPercent: true,
              standingDiscountFixed: true,
            },
          },
        },
        orderBy: [{ student: { firstName: "asc" } }, { date: "asc" }],
      })
    : [];
  const upcomingBookings: UpcomingBooking[] = upcomingBookingsRaw
    .filter((b): b is typeof b & { student: NonNullable<(typeof b)["student"]> } => b.student !== null)
    .map((b) => ({
      id: b.id,
      date: b.date.toISOString(),
      sessionType: b.sessionType,
      startTime: b.startTime,
      endTime: b.endTime,
      priceZarCents: b.priceZarCents,
      priceCurrency: (b.priceCurrency as string) ?? "ZAR",
      billingNote: b.billingNote,
      status: b.status,
      isLateCancel: b.isLateCancel,
      student: {
        id: b.student.id,
        firstName: b.student.firstName,
        lastName: b.student.lastName,
        standingDiscountPercent: b.student.standingDiscountPercent,
        standingDiscountFixed: b.student.standingDiscountFixed,
      },
    }));

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
  countMap.upcoming = upcomingCount;

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

  // Summary card calculations — based on last billing cycle
  // Paid invoices come from Invoice table; outstanding ones are still PaymentRequests
  let lastCyclePaid = 0;
  for (const s of lastCycleStats) {
    if (s.status === "paid") lastCyclePaid += s._sum.totalCents ?? 0;
  }
  // Outstanding = pending payment requests for this billing month
  let lastCycleOutstanding = 0;
  if (lastCycleBillingMonth) {
    const prTotal = await prisma.paymentRequest.aggregate({
      where: { status: "pending", billingMonth: lastCycleBillingMonth },
      _sum: { totalCents: true },
    });
    lastCycleOutstanding = prTotal._sum.totalCents ?? 0;
  }
  // Total billed that cycle = paid invoices + still-outstanding PRs
  const lastCycleTotal = lastCyclePaid + lastCycleOutstanding;
  const overdue = overdueResult._sum.totalCents ?? 0;
  // Friendly label for the last billing month, e.g. "2026-03" → "Mar 2026"
  const lastCycleLabel = lastCycleBillingMonth
    ? new Date(`${lastCycleBillingMonth}-01`).toLocaleDateString("en-ZA", { month: "short", year: "numeric" })
    : "—";

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Finance"
        description={`${totalCount} total invoices`}
        action={
          <div className="flex items-center gap-2">
            <NewPaymentRequestDialog />
            <ExportDialog />
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Last Cycle" value={formatCurrency(lastCycleTotal)} sub={lastCycleLabel} />
        <SummaryCard label="Collected" value={formatCurrency(lastCyclePaid)} sub={lastCycleLabel} variant="green" />
        <SummaryCard label="Outstanding" value={formatCurrency(lastCycleOutstanding)} sub={lastCycleLabel} variant="yellow" />
        <SummaryCard label="Overdue" value={formatCurrency(overdue)} sub="all time" variant="red" />
      </div>

      {/* Filters */}
      <InvoiceListFilters
        activeStatus={activeStatus}
        search={params.q || ""}
        activeType={activeType}
        activeMonth={activeMonth}
        counts={countMap}
      />

      {/* Table — Upcoming / Payment Requests / Invoices depending on tab */}
      {showUpcoming ? (
        <UpcomingBillingSection
          bookings={upcomingBookings}
          periodStart={billingPeriodStart.toISOString()}
          periodEnd={billingPeriodEnd.toISOString()}
        />
      ) : showPaymentRequests ? (
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
                          billingEmail={pr.student?.billingEmail ?? pr.student?.email ?? pr.billingEntity?.email ?? ""}
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
