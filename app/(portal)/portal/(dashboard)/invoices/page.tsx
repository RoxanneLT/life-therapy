export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, FileDown, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { PayButton } from "./pay-button";
import type { InvoiceLineItem } from "@/lib/billing-types";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  payment_requested: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  payment_requested: "Awaiting Payment",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  pending: "Pending",
};

const TYPE_LABELS: Record<string, string> = {
  monthly_postpaid: "Monthly Statement",
  package_purchase: "Package",
  course_purchase: "Course",
  product_sale: "Product",
  ad_hoc_session: "Session",
  credit_note: "Credit Note",
  other: "Other",
};

function formatCurrency(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function PortalInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { student } = await requirePasswordChanged();
  const params = await searchParams;

  // Pending payment requests
  const pendingRequests = await prisma.paymentRequest.findMany({
    where: {
      studentId: student.id,
      status: { in: ["pending", "overdue"] },
    },
    orderBy: { createdAt: "desc" },
  });

  // Invoice history
  const invoiceWhere: Record<string, unknown> = {
    studentId: student.id,
  };

  if (params.year) {
    const y = parseInt(params.year, 10);
    invoiceWhere.createdAt = {
      gte: new Date(y, 0, 1),
      lt: new Date(y + 1, 0, 1),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    orderBy: { createdAt: "desc" },
  });

  const hasContent = pendingRequests.length > 0 || invoices.length > 0;

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">Invoices</h1>

      {/* ── Pending Payment Requests ── */}
      {pendingRequests.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            Pending Payments
          </h2>
          <div className="space-y-3">
            {pendingRequests.map((pr) => {
              const lineItems = pr.lineItems as unknown as InvoiceLineItem[];
              const monthLabel = format(new Date(pr.periodEnd), "MMMM yyyy");

              return (
                <Card
                  key={pr.id}
                  className={
                    pr.status === "overdue"
                      ? "border-red-200 bg-red-50/30"
                      : "border-yellow-200 bg-yellow-50/30"
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">
                            Statement for {monthLabel}
                          </p>
                          <Badge
                            variant="secondary"
                            className={
                              pr.status === "overdue"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                            }
                          >
                            {STATUS_LABELS[pr.status] || pr.status}
                          </Badge>
                        </div>

                        {/* Line items summary */}
                        <div className="mt-2 space-y-1">
                          {lineItems.map((item, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs text-muted-foreground"
                            >
                              <span>
                                {item.description}
                                {item.subLine && (
                                  <span className="ml-1 text-muted-foreground/60">
                                    ({item.subLine})
                                  </span>
                                )}
                              </span>
                              <span className="ml-4 shrink-0">
                                {formatCurrency(item.totalCents)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>
                            Due: {format(new Date(pr.dueDate), "d MMM yyyy")}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <p className="text-lg font-bold">
                          {formatCurrency(pr.totalCents)}
                        </p>
                        <PayButton type="payment_request" id={pr.id} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Invoice History ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Invoice History
          </h2>
          <YearFilter currentYear={params.year} />
        </div>

        {invoices.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {params.year
                ? `No invoices for ${params.year}.`
                : "No invoices yet."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <Card key={inv.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-medium">
                          {inv.invoiceNumber}
                        </p>
                        <Badge
                          variant="secondary"
                          className={STATUS_COLORS[inv.status] || ""}
                        >
                          {STATUS_LABELS[inv.status] || inv.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[inv.type] || inv.type}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(inv.createdAt), "d MMM yyyy")}
                        {inv.billingMonth && ` \u00b7 Period: ${inv.billingMonth}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <p className="font-mono text-sm font-semibold">
                        {formatCurrency(inv.totalCents)}
                      </p>

                      {(inv.status === "payment_requested" ||
                        inv.status === "overdue") && (
                        <PayButton type="invoice" id={inv.id} />
                      )}

                      {inv.pdfUrl && (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {!hasContent && pendingRequests.length === 0 && invoices.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <Receipt className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No invoices yet.</p>
        </div>
      )}
    </div>
  );
}

function YearFilter({ currentYear }: { currentYear?: string }) {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

  return (
    <div className="flex items-center gap-1">
      <a
        href="/portal/invoices"
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          !currentYear
            ? "bg-brand-50 text-brand-700"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        All
      </a>
      {years.map((y) => (
        <a
          key={y}
          href={`/portal/invoices?year=${y}`}
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            currentYear === String(y)
              ? "bg-brand-50 text-brand-700"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {y}
        </a>
      ))}
    </div>
  );
}
