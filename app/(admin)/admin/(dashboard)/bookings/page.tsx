export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { getSiteSettings, getBusinessHours } from "@/lib/settings";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, Settings, ShieldOff, Repeat, X } from "lucide-react";
import type { BookingStatus } from "@/lib/generated/prisma/client";
import { ViewSwitcher } from "./view-switcher";
import { DayView } from "./day-view";
import { WeekView } from "./week-view";
import { MonthView } from "./month-view";
import { CreateBookingDialog } from "./create-booking-dialog";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
};

const VALID_VIEWS = ["list", "day", "week", "month"] as const;
type ViewMode = (typeof VALID_VIEWS)[number];

interface Props {
  readonly searchParams: Promise<{
    status?: string;
    view?: string;
    date?: string;
    series?: string;
  }>;
}

export default async function BookingsPage({ searchParams }: Props) {
  await requireRole("super_admin", "editor");

  const sp = await searchParams;
  const statusFilter = sp.status || undefined;
  const seriesFilter = sp.series || undefined;
  const view: ViewMode = VALID_VIEWS.includes(sp.view as ViewMode)
    ? (sp.view as ViewMode)
    : "list";
  const selectedDate = sp.date || format(new Date(), "yyyy-MM-dd");

  // Build status filter
  const statusWhere = statusFilter
    ? { status: statusFilter as BookingStatus }
    : {};

  // Build series filter
  const seriesWhere = seriesFilter
    ? { recurringSeriesId: seriesFilter }
    : {};

  // Build date-range filter for calendar views
  // Use UTC midnight for all @db.Date comparisons to avoid TZ drift
  let dateWhere: Record<string, unknown> = {};
  let weekMonday: Date | null = null;
  let weekSaturday: Date | null = null;

  if (view === "day") {
    const dayStart = new Date(selectedDate + "T00:00:00Z");
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    dateWhere = { date: { gte: dayStart, lt: dayEnd } };
  } else if (view === "week") {
    const anchor = new Date(selectedDate + "T00:00:00Z");
    const dow = anchor.getUTCDay(); // 0=Sun
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    weekMonday = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + mondayOffset));
    weekSaturday = new Date(Date.UTC(weekMonday.getUTCFullYear(), weekMonday.getUTCMonth(), weekMonday.getUTCDate() + 5));
    dateWhere = { date: { gte: weekMonday, lt: weekSaturday } };
  } else if (view === "month") {
    const anchor = new Date(selectedDate + "T00:00:00Z");
    const mStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const mEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)); // last day
    dateWhere = { date: { gte: mStart, lte: mEnd } };
  }

  const where = { ...statusWhere, ...dateWhere, ...seriesWhere };

  // Fetch bookings + counts in parallel
  const [bookings, counts] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy:
        view === "list"
          ? [{ date: "desc" }, { startTime: "desc" }]
          : [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  // Fetch business hours + overrides for calendar views
  let businessHours = null;
  let overrides: { date: Date; isBlocked: boolean; reason: string | null }[] = [];

  if (view !== "list") {
    const settings = await getSiteSettings();
    businessHours = getBusinessHours(settings);

    if (view === "day") {
      const ov = await prisma.availabilityOverride.findUnique({
        where: { date: new Date(selectedDate + "T00:00:00Z") },
        select: { date: true, isBlocked: true, reason: true },
      });
      overrides = ov ? [ov] : [];
    } else if (view === "week" && weekMonday && weekSaturday) {
      overrides = await prisma.availabilityOverride.findMany({
        where: { date: { gte: weekMonday, lt: weekSaturday } },
        select: { date: true, isBlocked: true, reason: true },
      });
    }
  }

  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count]),
  );
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  // Serialise bookings for client components
  const serialisedBookings = bookings.map((b) => ({
    id: b.id,
    date: format(new Date(b.date), "yyyy-MM-dd"),
    startTime: b.startTime,
    endTime: b.endTime,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    clientPhone: b.clientPhone,
    sessionType: b.sessionType,
    status: b.status,
    teamsMeetingUrl: b.teamsMeetingUrl,
    adminNotes: b.adminNotes,
  }));

  const serialisedOverrides = overrides.map((ov) => ({
    date: format(new Date(ov.date), "yyyy-MM-dd"),
    isBlocked: ov.isBlocked,
    reason: ov.reason,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Manage session bookings and client appointments.
          </p>
        </div>
        <div className="flex gap-2">
          <CreateBookingDialog />
          <Link href="/admin/bookings/availability">
            <Button variant="outline" size="sm">
              <ShieldOff className="mr-2 h-4 w-4" />
              Availability
            </Button>
          </Link>
          <Link href="/admin/bookings/settings">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Series filter banner */}
      {seriesFilter && (
        <div className="flex items-center gap-2 rounded-md border bg-purple-50 px-4 py-2">
          <Repeat className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">
            Showing {bookings.length} session{bookings.length !== 1 ? "s" : ""} in recurring series
          </span>
          <Link href="/admin/bookings" className="ml-auto">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-purple-600 hover:text-purple-800">
              <X className="h-3 w-3" />
              Clear filter
            </Button>
          </Link>
        </div>
      )}

      {/* View switcher */}
      <ViewSwitcher activeView={view} />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        <Link href={view === "list" ? "/admin/bookings" : `/admin/bookings?view=${view}&date=${selectedDate}`}>
          <Badge
            variant={statusFilter ? "outline" : "default"}
            className="cursor-pointer"
          >
            All ({total})
          </Badge>
        </Link>
        {(
          ["confirmed", "pending", "completed", "cancelled", "no_show"] as const
        ).map((status) => {
          const params = new URLSearchParams({ status });
          if (view !== "list") {
            params.set("view", view);
            params.set("date", selectedDate);
          }
          const href = `/admin/bookings?${params.toString()}`;
          return (
            <Link key={status} href={href}>
              <Badge
                variant={statusFilter === status ? "default" : "outline"}
                className="cursor-pointer"
              >
                {status.replace("_", " ")} ({countMap[status] || 0})
              </Badge>
            </Link>
          );
        })}
      </div>

      {/* View content */}
      {view === "list" && (
        <>
          {bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 font-heading text-lg font-semibold">
                No bookings
                {statusFilter ? ` with status "${statusFilter}"` : ""}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bookings will appear here when clients schedule sessions.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((booking) => {
                    const config = getSessionTypeConfig(booking.sessionType);
                    return (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">
                          {format(new Date(booking.date), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          {booking.startTime} – {booking.endTime}
                        </TableCell>
                        <TableCell>
                          <div>{booking.clientName}</div>
                          <div className="text-xs text-muted-foreground">
                            {booking.clientEmail}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span>{config.label}</span>
                          {booking.recurringSeriesId && (
                            <Repeat className="ml-1 inline h-3 w-3 text-purple-500" />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={STATUS_STYLES[booking.status]}
                          >
                            {booking.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/bookings/${booking.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {view === "day" && (
        <DayView
          bookings={serialisedBookings}
          date={selectedDate}
          businessHours={businessHours}
          override={serialisedOverrides[0] || null}
        />
      )}

      {view === "week" && (
        <WeekView
          bookings={serialisedBookings}
          date={selectedDate}
          businessHours={businessHours}
          overrides={serialisedOverrides}
        />
      )}

      {view === "month" && (
        <MonthView bookings={serialisedBookings} date={selectedDate} />
      )}
    </div>
  );
}
