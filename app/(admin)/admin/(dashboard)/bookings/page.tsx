export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSessionTypeConfig, TIMEZONE } from "@/lib/booking-config";
import { getSiteSettings, getBusinessHours } from "@/lib/settings";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
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
import { CalendarDays, Settings, ShieldOff, Repeat, X, AlertTriangle } from "lucide-react";
import { StaleQuickActions } from "./stale-quick-actions";
import type { BookingStatus } from "@/lib/generated/prisma/client";
import { BOOKING_STATUS_BADGE } from "@/lib/status-styles";
import { ViewSwitcher } from "./view-switcher";
import { MonthView } from "./month-view";
import { CreateBookingDialog } from "./create-booking-dialog";
import { CalendarShell } from "./calendar-shell";
import { SeriesTimeline } from "./series-timeline";
import { ClientQuickView } from "@/components/admin/client-quick-view";
import { PaginationControls } from "@/components/admin/pagination-controls";

const VALID_VIEWS = ["list", "day", "week", "month"] as const;
type ViewMode = (typeof VALID_VIEWS)[number];

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/** Return the next open business day (SAST). Skips closed days and past-close today. */
async function getNextBusinessDate(): Promise<string> {
  const now = new Date();
  const nowSast = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
  const nowTimeSast = formatInTimeZone(now, TIMEZONE, "HH:mm");
  const settings = await getSiteSettings();
  const bh = getBusinessHours(settings);
  const candidate = new Date(`${nowSast}T12:00:00Z`);

  for (let i = 0; i < 7; i++) {
    const d = new Date(candidate.getTime() + i * 86400000);
    const dayHours = bh[DAY_NAMES[d.getUTCDay()]];

    if (!dayHours || dayHours.closed) continue;
    // If today but past closing time, skip to next day
    if (i === 0 && nowTimeSast >= dayHours.close) continue;
    return format(d, "yyyy-MM-dd");
  }

  return nowSast;
}

interface Props {
  readonly searchParams: Promise<{
    status?: string;
    view?: string;
    date?: string;
    series?: string;
    page?: string;
  }>;
}

export default async function BookingsPage({ searchParams }: Props) {
  await requireRole("super_admin", "editor");

  const sp = await searchParams;
  const statusFilter = sp.status || undefined;
  const isStale = statusFilter === "stale";
  const seriesFilter = sp.series || undefined;
  const view: ViewMode = VALID_VIEWS.includes(sp.view as ViewMode)
    ? (sp.view as ViewMode)
    : "list";

  const selectedDate = sp.date || (
    (view === "day" || view === "week")
      ? await getNextBusinessDate()
      : format(new Date(), "yyyy-MM-dd")
  );

  // Build status filter
  // Calendar views default to excluding cancelled/no_show; list shows everything
  // "stale" is a pseudo-status meaning: confirmed + date < today
  let statusWhere: Record<string, unknown> = {};
  if (isStale) {
    statusWhere = { status: "confirmed" as BookingStatus };
  } else if (statusFilter) {
    statusWhere = { status: statusFilter as BookingStatus };
  } else if (view === "day" || view === "week" || view === "month") {
    statusWhere = { status: { notIn: ["cancelled", "no_show"] as BookingStatus[] } };
  }

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

  // List view defaults to upcoming bookings only (today forward, nearest first)
  // Exception: series filter shows ALL bookings (past + future) for the full timeline
  // Exception: stale filter shows only past bookings
  const todaySast = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  if (view === "list" && !dateWhere.date && !seriesFilter) {
    dateWhere = isStale
      ? { date: { lt: new Date(todaySast + "T00:00:00Z") } }
      : { date: { gte: new Date(todaySast + "T00:00:00Z") } };
  }

  const where = { ...statusWhere, ...dateWhere, ...seriesWhere };

  const shouldPaginate = view === "list" && !seriesFilter;
  const page = shouldPaginate ? (Number(sp.page) || 1) : 1;
  const pageSize = 50;
  const skip = (page - 1) * pageSize;

  // Fetch bookings + counts in parallel
  const [bookings, totalCount, counts, staleCount] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      ...(shouldPaginate ? { take: pageSize, skip } : {}),
    }),
    shouldPaginate
      ? prisma.booking.count({ where })
      : Promise.resolve(0),
    prisma.booking.groupBy({
      by: ["status"],
      _count: true,
      where: view === "list" ? { date: { gte: new Date(todaySast + "T00:00:00Z") } } : undefined,
    }),
    prisma.booking.count({
      where: { status: "confirmed", date: { lt: new Date(todaySast + "T00:00:00Z") } },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  function buildPageUrl(targetPage: number): string {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (sp.view) params.set("view", sp.view);
    if (sp.date) params.set("date", sp.date);
    if (sp.series) params.set("series", sp.series);
    if (targetPage > 1) params.set("page", String(targetPage));
    const qs = params.toString();
    return `/admin/bookings${qs ? `?${qs}` : ""}`;
  }

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
    couplesPartnerName: b.couplesPartnerName,
    sessionType: b.sessionType,
    status: b.status,
    teamsMeetingUrl: b.teamsMeetingUrl,
    adminNotes: b.adminNotes,
    studentId: b.studentId,
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

      {/* Stale sessions banner */}
      {isStale && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-900/20">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="flex-1 text-sm font-medium text-amber-800 dark:text-amber-300">
            {totalCount} past session{totalCount === 1 ? "" : "s"} still confirmed — mark each individually or use the dashboard to bulk-complete.
          </span>
          <Link href="/admin/bookings">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-amber-700 hover:text-amber-900 dark:text-amber-400">
              <X className="h-3 w-3" />
              Clear filter
            </Button>
          </Link>
        </div>
      )}

      {/* Series filter banner */}
      {seriesFilter && (
        <div className="flex items-center gap-2 rounded-md border bg-purple-50 px-4 py-2 dark:bg-purple-900/20 dark:text-purple-300">
          <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <span className="text-sm font-medium text-purple-800 dark:text-purple-300">
            Showing {bookings.length} session{bookings.length !== 1 ? "s" : ""} in recurring series
          </span>
          <Link href="/admin/bookings" className="ml-auto">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-200">
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
            variant={!statusFilter ? "default" : "outline-solid"}
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
                variant={statusFilter === status ? "default" : "outline-solid"}
                className="cursor-pointer"
              >
                {status.replace("_", " ")} ({countMap[status] || 0})
              </Badge>
            </Link>
          );
        })}
        <Link href="/admin/bookings?status=stale">
          <Badge
            variant={isStale ? "default" : "outline-solid"}
            className="cursor-pointer"
          >
            <AlertTriangle className="mr-1 h-3 w-3" />
            Stale ({staleCount})
          </Badge>
        </Link>
      </div>

      {/* View content */}
      {seriesFilter && (
        <SeriesTimeline
          seriesId={seriesFilter}
          bookings={serialisedBookings.map((b) => ({
            id: b.id,
            date: b.date,
            startTime: b.startTime,
            endTime: b.endTime,
            status: b.status,
            clientName: b.clientName,
          }))}
        />
      )}

      {!seriesFilter && view === "list" && (
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
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-xs font-semibold text-brand-700 dark:text-brand-300">
                              {booking.clientName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                            <div>
                              <div>
                                {booking.studentId ? (
                                  <ClientQuickView studentId={booking.studentId}>
                                    {booking.clientName}
                                  </ClientQuickView>
                                ) : (
                                  booking.clientName
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{booking.clientEmail}</div>
                            </div>
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
                            className={BOOKING_STATUS_BADGE[booking.status]}
                          >
                            {booking.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {isStale ? (
                            <div className="flex items-center justify-end gap-1">
                              <StaleQuickActions bookingId={booking.id} />
                              <Link href={`/admin/bookings/${booking.id}`}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs">
                                  View
                                </Button>
                              </Link>
                            </div>
                          ) : (
                            <Link href={`/admin/bookings/${booking.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
                buildUrl={buildPageUrl}
              />
            </div>
          )}
        </>
      )}

      {!seriesFilter && (view === "day" || view === "week") && (
        <CalendarShell
          view={view}
          bookings={serialisedBookings}
          date={selectedDate}
          businessHours={businessHours}
          overrides={serialisedOverrides}
        />
      )}

      {!seriesFilter && view === "month" && (
        <MonthView bookings={serialisedBookings} date={selectedDate} />
      )}
    </div>
  );
}
