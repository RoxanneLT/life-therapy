import { CalendarDays, Banknote } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { DashboardCardTitle } from "./dashboard-card-title";
import { getBookingsByMonth, getRevenueByMonth } from "@/lib/dashboard-queries";
import { BookingsChart } from "@/components/admin/bookings-chart";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { YearSelector } from "@/components/admin/year-selector";
import type { AdminRole } from "@/lib/generated/prisma/client";

/** The year's activity charts: the heaviest queries on the page, so they stream in last. */
export async function DashboardCharts({ role, year }: Readonly<{ role: AdminRole; year: number }>) {
  const showBookings = role === "super_admin" || role === "editor";
  const showRevenue = role === "super_admin";
  if (!showBookings && !showRevenue) return null;

  const [bookingsByMonth, revenueByMonth] = await Promise.all([
    showBookings ? getBookingsByMonth(year) : null,
    showRevenue ? getRevenueByMonth(year) : null,
  ]);

  // On a desktop the charts take whatever height the cards above leave, so the dashboard fits one
  // screen (page.tsx makes the page fill the viewport). Below 200px they stop shrinking and the
  // page scrolls instead; on a phone the page scrolls as usual and the charts keep a fixed 300px.
  // The drawing is absolutely placed: ChartContainer draws at the pixel size it last measured, and
  // in flow that drawing would hold the card open, so the charts could grow with the window but
  // never shrink back.
  const chartSize =
    "relative h-[300px] lg:h-auto lg:min-h-[200px] lg:flex-1 [&>.recharts-wrapper]:absolute [&>.recharts-wrapper]:inset-0";
  return (
    <div className="flex flex-col gap-3 lg:flex-1">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity Overview</h2>
        <YearSelector currentYear={year} />
      </div>
      <div className="grid gap-4 lg:flex-1 lg:grid-cols-2">
        {bookingsByMonth && (
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <DashboardCardTitle icon={CalendarDays}>Bookings per Month</DashboardCardTitle>
              <CardDescription>Planned &amp; completed sessions</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <BookingsChart data={bookingsByMonth} className={chartSize} />
            </CardContent>
          </Card>
        )}
        {revenueByMonth && (
          <Card className="flex flex-col">
            <CardHeader className="pb-2">
              <DashboardCardTitle icon={Banknote}>Revenue per Month</DashboardCardTitle>
              <CardDescription>Paid, pending &amp; estimated revenue</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              <RevenueChart data={revenueByMonth} className={chartSize} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export function DashboardChartsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-40 rounded bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
            <div className="h-5 w-36 rounded bg-muted" />
            <div className="h-64 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
