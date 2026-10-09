import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity Overview</h2>
        <YearSelector currentYear={year} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {bookingsByMonth && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Bookings per Month</CardTitle>
              <CardDescription>Planned &amp; completed sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <BookingsChart data={bookingsByMonth} />
            </CardContent>
          </Card>
        )}
        {revenueByMonth && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Revenue per Month</CardTitle>
              <CardDescription>Paid, pending &amp; estimated revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart data={revenueByMonth} />
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
