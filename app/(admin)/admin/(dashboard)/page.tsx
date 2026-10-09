export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { saToday } from "@/lib/dates";
import { AttentionQueue, AttentionQueueSkeleton } from "./attention-queue";
import { DashboardOverview, DashboardOverviewSkeleton } from "./dashboard-overview";
import { DashboardCharts, DashboardChartsSkeleton } from "./dashboard-charts";

/**
 * The admin home. The greeting renders at once; each section below queries for itself and streams
 * in behind a skeleton of its own shape. Until 2026-10-09 the page ran twelve queries in one
 * Promise.all and showed nothing until the slowest (the year's charts) returned.
 *
 * Every section is gated by the role of the page it links to (see lib/dashboard-attention.ts): the
 * dashboard is the one admin page every role reaches, so it must not offer links `requireRole` refuses.
 */
export default async function AdminDashboard({
  searchParams,
}: {
  readonly searchParams: Promise<{ year?: string }>;
}) {
  const { adminUser } = await getAuthenticatedAdmin();
  const params = await searchParams;
  const currentYear = Number(saToday().slice(0, 4));
  const year = params.year ? Number.parseInt(params.year, 10) : currentYear;
  const validYear = year >= currentYear - 2 && year <= currentYear + 2 ? year : currentYear;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Welcome back{adminUser.name ? `, ${adminUser.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening on your platform today.
        </p>
      </div>

      <Suspense fallback={<AttentionQueueSkeleton />}>
        <AttentionQueue role={adminUser.role} />
      </Suspense>

      <Suspense fallback={<DashboardOverviewSkeleton />}>
        <DashboardOverview role={adminUser.role} />
      </Suspense>

      <Suspense key={validYear} fallback={<DashboardChartsSkeleton />}>
        <DashboardCharts role={adminUser.role} year={validYear} />
      </Suspense>
    </div>
  );
}
