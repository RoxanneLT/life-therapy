export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, UserCheck, CreditCard, Clock, Cake, Banknote, Video, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { getBookingsByMonth, getRevenueByMonth } from "@/lib/dashboard-queries";
import { BookingsChart } from "@/components/admin/bookings-chart";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { YearSelector } from "@/components/admin/year-selector";
import { Button } from "@/components/ui/button";

function getBirthdayThisYear(dob: Date, referenceYear: number): Date {
  const bday = new Date(referenceYear, dob.getUTCMonth(), dob.getUTCDate());
  return bday;
}

function getUpcomingBirthdays(
  students: { firstName: string; lastName: string; dateOfBirth: Date | null }[],
  now: Date,
  until: Date,
) {
  return students
    .filter((s): s is typeof s & { dateOfBirth: Date } => s.dateOfBirth !== null)
    .map((s) => {
      let bday = getBirthdayThisYear(s.dateOfBirth, now.getFullYear());
      if (bday < now) bday = getBirthdayThisYear(s.dateOfBirth, now.getFullYear() + 1);
      return {
        name: `${s.firstName} ${s.lastName}`,
        date: bday.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }),
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
  const sessionDate = new Date(session.date);
  const [h, m] = (session.startTime ?? "00:00").split(":").map(Number);
  sessionDate.setHours(h, m, 0, 0);
  return sessionDate <= deadline;
}

export default async function AdminDashboard({
  searchParams,
}: {
  readonly searchParams: Promise<{ year?: string }>;
}) {
  const { adminUser } = await getAuthenticatedAdmin();
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = params.year ? Number.parseInt(params.year, 10) : currentYear;
  const validYear = year >= currentYear - 2 && year <= currentYear + 2 ? year : currentYear;

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [
    upcomingBookings,
    studentCount,
    thisMonthRevenue,
    pendingPayments,
    nextSession,
    allStudentsWithDob,
    bookingsByMonth,
    revenueByMonth,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        status: { in: ["pending", "confirmed"] },
        date: { gte: now },
      },
    }),
    prisma.student.count({ where: { clientStatus: "active" } }),
    prisma.invoice.aggregate({
      where: {
        status: "paid",
        billingMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      },
      _sum: { paidAmountCents: true },
    }),
    prisma.paymentRequest.aggregate({
      where: { status: "pending" },
      _count: true,
      _sum: { totalCents: true },
    }),
    prisma.booking.findFirst({
      where: { status: "confirmed", date: { gte: now } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: { id: true, clientName: true, date: true, startTime: true, endTime: true, teamsMeetingUrl: true, sessionType: true },
    }),
    prisma.student.findMany({
      where: { dateOfBirth: { not: null }, clientStatus: { in: ["active", "potential"] } },
      select: { firstName: true, lastName: true, dateOfBirth: true },
    }),
    getBookingsByMonth(validYear),
    getRevenueByMonth(validYear),
  ]);

  const upcomingBirthdays = getUpcomingBirthdays(allStudentsWithDob, now, sevenDaysFromNow);
  const isSessionSoon = nextSession ? isWithinTwoHours(nextSession, twoHoursFromNow) : false;

  const pendingCount = pendingPayments._count ?? 0;
  const pendingTotal = pendingPayments._sum.totalCents ?? 0;

  const stats = [
    {
      label: "Active Clients",
      value: studentCount,
      icon: UserCheck,
      href: "/admin/clients?status=active",
    },
    {
      label: "Revenue (This Month)",
      value: formatPrice(thisMonthRevenue._sum.paidAmountCents ?? 0),
      icon: Banknote,
      href: "/admin/invoices?status=paid",
    },
    {
      label: "Outstanding",
      value: pendingTotal > 0 ? formatPrice(pendingTotal) : "R 0",
      icon: CreditCard,
      href: "/admin/invoices?status=payment_requested",
    },
    {
      label: "Upcoming Bookings",
      value: upcomingBookings,
      icon: CalendarDays,
      href: "/admin/bookings",
    },
  ];

  const sessionTypeLabels: Record<string, string> = {
    individual: "Individual",
    couples: "Couples",
    free_consultation: "Free Consultation",
  };

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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Action Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Next Session */}
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
                    {new Date(nextSession.date).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" })}
                    {" "}&middot;{" "}
                    {nextSession.startTime}{nextSession.endTime ? `\u2013${nextSession.endTime}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
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
                    <Link href={`/admin/bookings/${nextSession.id}`}>
                      View Booking
                    </Link>
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming sessions</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Payments */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-3">
            {pendingCount > 0 ? (
              <>
                <div>
                  <p className="text-2xl font-bold">{formatPrice(pendingTotal)}</p>
                  <p className="text-sm text-muted-foreground">{pendingCount} payment{pendingCount === 1 ? "" : "s"} outstanding</p>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href="/admin/invoices?status=payment_requested">
                    View Payments
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">All payments up to date</p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Birthdays */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Birthdays</CardTitle>
            <Cake className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-3">
            {upcomingBirthdays.length > 0 ? (
              <ul className="space-y-1">
                {upcomingBirthdays.slice(0, 4).map((b) => (
                  <li key={b.name} className="text-sm">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-muted-foreground"> &mdash; {b.date}</span>
                  </li>
                ))}
                {upcomingBirthdays.length > 4 && (
                  <li className="text-xs text-muted-foreground">+{upcomingBirthdays.length - 4} more</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming birthdays</p>
            )}
          </CardContent>
        </Card>

        {/* Capture Payment */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Capture Payment</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-between gap-3">
            <p className="text-sm text-muted-foreground">Record direct payments (EFT/cash)</p>
            <Button asChild size="sm" variant="outline" className="w-full">
              <Link href="/admin/invoices?status=payment_requested">
                Go to Payments
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Activity Overview</h2>
        <YearSelector currentYear={validYear} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Bookings per Month</CardTitle>
            <CardDescription>Planned &amp; completed sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <BookingsChart data={bookingsByMonth} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Revenue per Month</CardTitle>
            <CardDescription>Paid, pending &amp; estimated revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueByMonth} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
