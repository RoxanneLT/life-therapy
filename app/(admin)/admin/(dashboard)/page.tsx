export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { requireAccess } from "@/lib/auth";
import { saToday } from "@/lib/dates";
import { AttentionQueue, AttentionQueueSkeleton } from "./attention-queue";
import { DashboardGlance, DashboardGlanceSkeleton, DashboardStats, DashboardStatsSkeleton, DashboardTopRow } from "./dashboard-overview";
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
  const { adminUser } = await requireAccess("/admin");
  const params = await searchParams;
  const currentYear = Number(saToday().slice(0, 4));
  const year = params.year ? Number.parseInt(params.year, 10) : currentYear;
  const validYear = year >= currentYear - 2 && year <= currentYear + 2 ? year : currentYear;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${adminUser.name ? `, ${adminUser.name}` : ""}`}
        description="Here's what's happening on your platform today."
      />

      <DashboardTopRow
        attention={
          <Suspense fallback={<AttentionQueueSkeleton />}>
            <AttentionQueue role={adminUser.role} />
          </Suspense>
        }
        glance={
          <Suspense fallback={<DashboardGlanceSkeleton />}>
            <DashboardGlance role={adminUser.role} />
          </Suspense>
        }
      />

      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats role={adminUser.role} />
      </Suspense>

      <Suspense key={validYear} fallback={<DashboardChartsSkeleton />}>
        <DashboardCharts role={adminUser.role} year={validYear} />
      </Suspense>
    </div>
  );
}
