import { AttentionQueueSkeleton } from "./attention-queue";
import { DashboardOverviewSkeleton } from "./dashboard-overview";
import { DashboardChartsSkeleton } from "./dashboard-charts";

/** The same skeletons the page streams behind, so arriving here and the page filling in look alike. */
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="animate-pulse space-y-2">
        <div className="h-8 w-56 rounded-md bg-muted" />
        <div className="h-4 w-72 rounded bg-muted" />
      </div>
      <AttentionQueueSkeleton />
      <DashboardOverviewSkeleton />
      <DashboardChartsSkeleton />
    </div>
  );
}
