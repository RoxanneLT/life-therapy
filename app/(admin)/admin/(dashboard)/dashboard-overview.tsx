import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, UserCheck, CreditCard, Clock, Cake, Banknote, Video } from "lucide-react";
import { formatByCurrency } from "@/lib/utils";
import { saToday, saDateStr, saDayStart, saMonthStart, saFormat, bookingStartsAt, calendarDate } from "@/lib/dates";
import type { AdminRole } from "@/lib/generated/prisma/client";
import { canAccess } from "@/lib/admin-access";


const sessionTypeLabels: Record<string, string> = {
  individual: "Individual",
  couples: "Couples",
  free_consultation: "Free Consultation",
};

function getBirthdayThisYear(dob: Date, referenceYear: number): Date {
  // dob is a `@db.Date`, so its UTC month/day are the real ones. Anchor the
  // birthday to the start of that SAST day, not the server's local midnight.
  const mm = String(dob.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dob.getUTCDate()).padStart(2, "0");
  return saDayStart(`${referenceYear}-${mm}-${dd}`);
}

function getUpcomingBirthdays(
  students: { firstName: string; lastName: string; dateOfBirth: Date | null }[],
  now: Date,
  until: Date,
) {
  const thisYear = Number(saDateStr(now).slice(0, 4));
  return students
    .filter((s): s is typeof s & { dateOfBirth: Date } => s.dateOfBirth !== null)
    .map((s) => {
      let bday = getBirthdayThisYear(s.dateOfBirth, thisYear);
      if (bday < now) bday = getBirthdayThisYear(s.dateOfBirth, thisYear + 1);
      return {
        name: `${s.firstName} ${s.lastName}`,
        date: saFormat(bday, "d MMM"),
        sortDate: bday,
      };
    })
    .filter((b) => b.sortDate >= now && b.sortDate <= until)
    .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
}

function isWithinTwoHours(
  session: { date: Date; startTime: string | null },
  deadline: Date,
): boolean {
  // `setHours` would apply the *server's* timezone to a SAST wall-clock time,
  // making a 09:00 SAST session look like it starts at 09:00 UTC — two hours late.
  return bookingStartsAt({ date: session.date, startTime: session.startTime ?? "00:00" }) <= deadline;
}

/**
 * The two at-a-glance cards that sit beside "Needs attention" in the dashboard's first row. Rendered
 * as a fragment so each card is its own grid cell. Each is shown only to roles that can open its link.
 *
 * A third card, Pending Payments, was removed on 2026-10-10. It counted `status: "pending"` alone,
 * so a request the cron had moved to "overdue" left it, and the card read "All payments up to date"
 * directly beneath "2 payment requests past due". The attention row counts pending-or-overdue past
 * the due date (lib/dashboard-attention.ts) and is the one place this is reported now.
 */
export async function DashboardGlance({ role }: Readonly<{ role: AdminRole }>) {
  const can = (href: string) => canAccess(href, role);
  const none = Promise.resolve(null);

  const today = saToday();
  const saYear = Number(today.slice(0, 4));
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [nextSessionCandidates, studentsWithDob] = await Promise.all([
    // `date` is a `@db.Date` at UTC midnight, so `gte: now` excluded EVERY session
    // today from 02:00 SAST — the card skipped to tomorrow while Roxanne still had
    // three sessions to run, and the "starting soon" highlight below could never
    // fire at all. The day is the only thing the column can filter on; which of
    // today's sessions is still ahead is a question about start TIME, so that part
    // is decided in code with bookingStartsAt(). 25 covers any real day's diary.
    can("/admin/bookings")
      ? prisma.booking.findMany({
          where: { status: "confirmed", date: { gte: calendarDate(today) } },
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          take: 25,
          select: { id: true, clientName: true, date: true, startTime: true, endTime: true, teamsMeetingUrl: true, sessionType: true },
        })
      : none,
    // Every active or potential client with a birthday on file: under two hundred rows, so the
    // day-of-year arithmetic stays in code rather than in SQL over a `@db.Date`.
    can("/admin/clients")
      ? prisma.student.findMany({
          where: { dateOfBirth: { not: null }, clientStatus: { in: ["active", "potential"] } },
          select: { firstName: true, lastName: true, dateOfBirth: true },
        })
      : none,
  ]);

  // Show the next 3 birthdays within a year. Anchor the window to the start of today in SAST so a
  // birthday *today* stays listed all day, rather than dropping off at the server's midnight.
  const todayStart = saDayStart(today);
  const farFuture = saDayStart(`${saYear + 1}${today.slice(4)}`);
  const upcomingBirthdays = studentsWithDob ? getUpcomingBirthdays(studentsWithDob, todayStart, farFuture).slice(0, 3) : [];
  // The first session that has not started yet — today's included.
  const nextSession =
    nextSessionCandidates?.find((b) => bookingStartsAt({ date: b.date, startTime: b.startTime ?? "00:00" }) >= now) ?? null;
  const isSessionSoon = nextSession ? isWithinTwoHours(nextSession, twoHoursFromNow) : false;

  return (
    <>
      {can("/admin/bookings") && (
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next Session</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-3">
            {nextSession ? (
              <>
                <div>
                  <p className="font-semibold">{nextSession.clientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {saFormat(nextSession.date, "EEE d MMM")}
                    {" "}&middot;{" "}
                    {nextSession.startTime}{nextSession.endTime ? `–${nextSession.endTime}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {sessionTypeLabels[nextSession.sessionType] ?? nextSession.sessionType}
                  </p>
                </div>
                {isSessionSoon && nextSession.teamsMeetingUrl ? (
                  <Button asChild size="sm" className="w-full">
                    <a href={nextSession.teamsMeetingUrl} target="_blank" rel="noopener noreferrer">
                      <Video className="mr-2 h-4 w-4" />
                      Join Now
                    </a>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={`/admin/bookings/${nextSession.id}`}>View Booking</Link>
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming sessions</p>
            )}
          </CardContent>
        </Card>
      )}

      {can("/admin/clients") && (
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Birthdays</CardTitle>
            <Cake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingBirthdays.length > 0 ? (
              <ul className="space-y-1">
                {upcomingBirthdays.map((b) => (
                  <li key={b.name} className="text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-muted-foreground"> &mdash; {b.date}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming birthdays</p>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** The two glance cards' skeletons, as a fragment for the same grid. */
export function DashboardGlanceSkeleton() {
  return (
    <>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="animate-pulse space-y-3 rounded-xl border bg-card p-6">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="h-8 w-full rounded bg-muted" />
        </div>
      ))}
    </>
  );
}

/** The headline numbers. Each tile is shown only to roles that can open its link. */
export async function DashboardStats({ role }: Readonly<{ role: AdminRole }>) {
  const can = (href: string) => canAccess(href, role);
  const none = Promise.resolve(null);

  const [saYear, saMonth] = saToday().split("-").map(Number);
  const monthStart = saMonthStart(saYear, saMonth);
  const monthEnd = saMonthStart(saYear, saMonth + 1);
  const nextMonthEnd = saMonthStart(saYear, saMonth + 2);

  const [studentCount, thisMonthRevenue, sessionsThisMonth, nextMonthSessions] = await Promise.all([
    can("/admin/clients") ? prisma.student.count({ where: { clientStatus: "active" } }) : none,
    // Revenue = CASH RECEIVED THIS MONTH, so filter on `paidAt` — not on
    // `billingMonth`, which was wrong twice over:
    //   1. Only the payment-request path ever populates `billingMonth`, so every
    //      course sale, product sale, late-cancel fee and manual invoice was
    //      invisible to this tile.
    //   2. It names the billing PERIOD, not the payment. A June request settled
    //      in July landed in no month's tile at all.
    // `paidAt` is a real instant, so the bounds are SAST month starts.
    //
    // Rows rather than a _sum: cents are per-currency and must never be added,
    // and `paidAmountCents` is nullable (an invoice marked paid from the list
    // view never sets it) — so coalesce to `totalCents` per row instead of
    // silently dropping the amount.
    can("/admin/invoices")
      ? prisma.invoice.findMany({
          where: { status: "paid", paidAt: { gte: monthStart, lt: monthEnd } },
          select: { currency: true, paidAmountCents: true, totalCents: true },
        })
      : none,
    can("/admin/bookings")
      ? prisma.booking.count({
          where: { status: { in: ["completed", "confirmed", "pending"] }, date: { gte: monthStart, lt: monthEnd } },
        })
      : none,
    can("/admin/bookings")
      ? prisma.booking.count({
          where: { status: { in: ["confirmed", "pending"] }, date: { gte: monthEnd, lt: nextMonthEnd } },
        })
      : none,
  ]);

  const revenueByCurrency = new Map<string, number>();
  for (const inv of thisMonthRevenue ?? []) {
    const cents = inv.paidAmountCents ?? inv.totalCents;
    revenueByCurrency.set(inv.currency, (revenueByCurrency.get(inv.currency) ?? 0) + cents);
  }
  const revenueThisMonth = formatByCurrency([...revenueByCurrency].map(([currency, cents]) => ({ currency, cents })));

  // The bookings month view takes any day of the month it should show.
  const monthHref = (d: Date) => `/admin/bookings?view=month&date=${saDateStr(d)}`;
  const stats = [
    can("/admin/clients") && { label: "Active Clients", value: studentCount, icon: UserCheck, href: "/admin/clients?status=active" },
    can("/admin/invoices") && { label: "Revenue (This Month)", value: revenueThisMonth, icon: Banknote, href: "/admin/invoices?status=paid" },
    can("/admin/bookings") && { label: `Sessions (${saFormat(monthStart, "MMM")})`, value: sessionsThisMonth, icon: CreditCard, href: monthHref(monthStart) },
    can("/admin/bookings") && { label: `Sessions (${saFormat(monthEnd, "MMM")})`, value: nextMonthSessions, icon: CalendarDays, href: monthHref(monthEnd) },
  ].filter((s) => s !== false);

  if (stats.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Link key={stat.label} href={stat.href}>
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export function DashboardStatsSkeleton() {
  return (
    <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-6">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-8 w-20 rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

/**
 * The dashboard's first row: "Needs attention" across two columns, the glance cards beside it.
 * Each child streams behind its own Suspense; this only owns the grid they share.
 */
export function DashboardTopRow({ attention, glance }: Readonly<{ attention: React.ReactNode; glance: React.ReactNode }>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="sm:col-span-2">{attention}</div>
      {glance}
    </div>
  );
}
