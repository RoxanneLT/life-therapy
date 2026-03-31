export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import {
  getFinancialSummary,
  getRevenueBySource,
  getPaymentStatusByMonth,
  getOutstandingAging,
  getSessionStats,
  getTimeSlotHeatmap,
  getSessionTypeBreakdown,
  getCancellationTrend,
  getClientGrowth,
  getClientStatusDistribution,
  getAtRiskClients,
  getRetentionRate,
} from "@/lib/report-queries";
import {
  RevenueBySourceChart,
  PaymentStatusChart,
  OutstandingAgingChart,
  TimeSlotHeatmap,
  SessionTypeChart,
  CancellationTrendChart,
  ClientGrowthChart,
  ClientStatusChart,
} from "./report-charts";
import { ExportTab } from "./export-tab";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

// --------------- FY Helpers ---------------

/** SA financial year: FY2026 = Mar 2025 - Feb 2026. If current month >= March, FY = year+1. */
function getCurrentFY(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  return month >= 2 ? now.getFullYear() + 1 : now.getFullYear();
}

// --------------- Tabs ---------------

const TABS = [
  { key: "financial", label: "Financial" },
  { key: "sessions", label: "Sessions" },
  { key: "clients", label: "Clients" },
  { key: "export", label: "Export" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// --------------- Page ---------------

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; fy?: string }>;
}) {
  await requireRole("super_admin");

  const params = await searchParams;
  const activeTab: TabKey = TABS.some((t) => t.key === params.tab)
    ? (params.tab as TabKey)
    : "financial";

  const currentFY = params.fy ? Number(params.fy) : getCurrentFY();

  // Generate FY options (current + last 3 years)
  const defaultFY = getCurrentFY();
  const fyOptions = [defaultFY, defaultFY - 1, defaultFY - 2, defaultFY - 3];

  // Fetch all data in parallel
  const [
    financialSummary,
    revenueBySource,
    paymentStatusByMonth,
    agingBuckets,
    sessionStats,
    timeSlotHeat,
    sessionTypeCounts,
    cancellationTrend,
    clientGrowth,
    clientStatusCounts,
    atRiskClients,
    retentionData,
  ] = await Promise.all([
    getFinancialSummary(currentFY),
    getRevenueBySource(currentFY),
    getPaymentStatusByMonth(currentFY),
    getOutstandingAging(),
    getSessionStats(currentFY),
    getTimeSlotHeatmap(currentFY),
    getSessionTypeBreakdown(currentFY),
    getCancellationTrend(currentFY),
    getClientGrowth(currentFY),
    getClientStatusDistribution(),
    getAtRiskClients(),
    getRetentionRate(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`FY${currentFY} (Mar ${currentFY - 1} \u2013 Feb ${currentFY})`}
      />

      {/* FY Selector + Tab Pills row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tab pills */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/admin/reports?tab=${tab.key}&fy=${currentFY}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* FY selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Financial Year:</span>
          <div className="flex gap-1">
            {fyOptions.map((fy) => (
              <Link
                key={fy}
                href={`/admin/reports?tab=${activeTab}&fy=${fy}`}
                className={`rounded-md px-2.5 py-1 text-sm font-medium transition-colors ${
                  currentFY === fy
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                FY{fy}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "financial" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="Total Revenue"
              value={formatZAR(financialSummary.totalRevenueCents)}
              variant="green"
            />
            <KPICard
              label="This Month"
              value={formatZAR(financialSummary.thisMonthRevenueCents)}
            />
            <KPICard
              label="Outstanding"
              value={formatZAR(financialSummary.outstandingCents)}
              variant="yellow"
            />
            <KPICard
              label="Avg Invoice"
              value={formatZAR(financialSummary.avgInvoiceValueCents)}
              sub={`${financialSummary.invoiceCount} invoices`}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Revenue by Source">
              <RevenueBySourceChart data={revenueBySource} />
            </ChartCard>
            <ChartCard title="Payment Status by Month">
              <PaymentStatusChart data={paymentStatusByMonth} />
            </ChartCard>
          </div>
          <ChartCard title="Outstanding Aging">
            <OutstandingAgingChart data={agingBuckets} />
          </ChartCard>
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="Sessions This Month"
              value={String(sessionStats.sessionsThisMonth)}
            />
            <KPICard
              label="Utilisation Rate"
              value={`${sessionStats.utilisationRate}%`}
              variant={sessionStats.utilisationRate >= 70 ? "green" : "yellow"}
            />
            <KPICard
              label="Avg Sessions / Client"
              value={sessionStats.avgSessionsPerClient.toFixed(1)}
            />
            <KPICard
              label="Cancellation Rate"
              value={`${sessionStats.cancellationRate}%`}
              variant={sessionStats.cancellationRate <= 10 ? "green" : "red"}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Session Types">
              <SessionTypeChart data={sessionTypeCounts} />
            </ChartCard>
            <ChartCard title="Cancellation Trend">
              <CancellationTrendChart data={cancellationTrend} />
            </ChartCard>
          </div>
          <ChartCard title="Time Slot Popularity">
            <TimeSlotHeatmap data={timeSlotHeat} />
          </ChartCard>
        </div>
      )}

      {activeTab === "clients" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KPICard
              label="Total Clients"
              value={String(
                clientStatusCounts.reduce((s, c) => s + c.count, 0)
              )}
            />
            <KPICard
              label="Active"
              value={String(
                clientStatusCounts.find(
                  (c) => c.status.toLowerCase() === "active"
                )?.count ?? 0
              )}
              variant="green"
            />
            <KPICard
              label="Retention Rate"
              value={`${retentionData.rate}%`}
              sub={`${retentionData.returningThisMonth} of ${retentionData.activeLastMonth} returned`}
              variant={retentionData.rate >= 70 ? "green" : "yellow"}
            />
            <KPICard
              label="At-Risk Clients"
              value={String(atRiskClients.length)}
              variant={atRiskClients.length > 0 ? "red" : "green"}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Client Growth">
              <ClientGrowthChart data={clientGrowth} />
            </ChartCard>
            <ChartCard title="Client Status Breakdown">
              <ClientStatusChart data={clientStatusCounts} />
            </ChartCard>
          </div>

          {/* At-Risk Clients Table */}
          {atRiskClients.length > 0 && (
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 border-b px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="font-medium">At-Risk Clients</h3>
                <span className="text-xs text-muted-foreground">
                  No session in 30+ days
                </span>
              </div>
              <div className="divide-y">
                {atRiskClients.slice(0, 10).map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div>
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-sm font-medium hover:text-brand-600 hover:underline"
                      >
                        {client.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {client.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-amber-600">
                        {client.daysSince} days
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last: {client.lastSessionDate}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "export" && (
        <ExportTab currentFY={currentFY} fyOptions={fyOptions} />
      )}
    </div>
  );
}

// --------------- Shared Components ---------------

function formatZAR(cents: number): string {
  return `R ${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function KPICard({
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
    green: "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
    yellow:
      "border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950",
    red: "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950",
  };

  return (
    <div className={`rounded-lg border p-4 ${variant ? colors[variant] : ""}`}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-4 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}
