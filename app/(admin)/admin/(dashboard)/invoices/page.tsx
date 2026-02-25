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
import { InvoiceListFilters } from "./invoice-list-filters";
import { InvoiceRowActions } from "./invoice-row-actions";
import { ExportDialog } from "./export-dialog";
import { SortableHeader } from "@/components/admin/sortable-header";

const STATUS_TABS = ["all", "draft", "payment_requested", "paid", "overdue", "cancelled"] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  payment_requested: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
  credited: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  payment_requested: "Requested",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  credited: "Credited",
};

const TYPE_LABELS: Record<string, string> = {
  monthly_postpaid: "Monthly",
  package_purchase: "Package",
  course_purchase: "Course",
  product_sale: "Product",
  ad_hoc_session: "Ad Hoc",
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

  const [invoices, statusCounts, monthStats] = await Promise.all([
    prisma.invoice.findMany({
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
  ]);

  // Status count map (for filter tabs)
  const countMap: Record<string, number> = {};
  let totalCount = 0;
  for (const c of statusCounts) {
    countMap[c.status] = c._count;
    totalCount += c._count;
  }
  countMap.all = totalCount;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} total invoices
          </p>
        </div>
        <ExportDialog />
      </div>

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

      {/* Table */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Receipt className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            {params.q ? "No invoices match your search." : "No invoices found."}
          </p>
        </div>
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
                        className={STATUS_COLORS[inv.status] || ""}
                      >
                        {STATUS_LABELS[inv.status] || inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <InvoiceRowActions
                        invoiceId={inv.id}
                        status={inv.status}
                        pdfUrl={inv.pdfUrl}
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
