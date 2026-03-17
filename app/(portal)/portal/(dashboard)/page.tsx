export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/portal/progress-bar";
import {
  CalendarDays,
  Coins,
  GraduationCap,
  ShoppingBag,
  Video,
  ArrowRight,
  FileText,
  BookOpen,
  FileDown,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, isToday } from "date-fns";
import { getSessionTypeConfig } from "@/lib/booking-config";
import Link from "next/link";

export default async function PortalDashboardPage() {
  const { student } = await requirePasswordChanged();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    upcomingBookingsCount,
    creditBalance,
    enrollments,
    digitalProductCount,
    nextBooking,
    recentInvoices,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        studentId: student.id,
        date: { gte: today },
        status: { in: ["pending", "confirmed"] },
      },
    }),
    prisma.sessionCreditBalance.findUnique({
      where: { studentId: student.id },
    }),
    prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: { course: { select: { title: true, slug: true } } },
      orderBy: { updatedAt: "desc" },
      take: 3,
    }),
    prisma.digitalProductAccess.count({ where: { studentId: student.id } }),
    prisma.booking.findFirst({
      where: {
        studentId: student.id,
        date: { gte: today },
        status: { in: ["pending", "confirmed"] },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.invoice.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        invoiceNumber: true,
        totalCents: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const currentBalance = creditBalance?.balance ?? 0;
  const isSessionsClient = upcomingBookingsCount > 0 || currentBalance > 0 || !!nextBooking;

  const sessionConfig = nextBooking
    ? getSessionTypeConfig(nextBooking.sessionType)
    : null;
  const bookingIsToday = nextBooking ? isToday(new Date(nextBooking.date)) : false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Welcome back, {student.firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Continue learning and growing with Life-Therapy.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Upcoming Sessions"
          value={upcomingBookingsCount}
          icon={CalendarDays}
          href="/portal/bookings"
        />
        <StatCard
          label="Session Credits"
          value={currentBalance}
          icon={Coins}
          href="/portal/credits"
        />
        <StatCard
          label="My Courses"
          value={enrollments.length}
          icon={GraduationCap}
          href="/portal/courses"
        />
        <StatCard
          label="Digital Products"
          value={digitalProductCount}
          icon={ShoppingBag}
          href="/portal/purchases"
        />
      </div>

      {/* Next Session */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Next Session</CardTitle>
        </CardHeader>
        <CardContent>
          {nextBooking && sessionConfig ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{sessionConfig.label}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(nextBooking.date), "EEEE, d MMMM yyyy")} &middot;{" "}
                  {nextBooking.startTime} – {nextBooking.endTime}
                </p>
                <p className="text-xs text-muted-foreground">
                  {nextBooking.durationMinutes} minutes
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {bookingIsToday && nextBooking.teamsMeetingUrl && (
                  <Button asChild size="sm">
                    <a
                      href={nextBooking.teamsMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Video className="mr-2 h-4 w-4" />
                      Join
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href="/portal/bookings">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No upcoming sessions</p>
              <Button asChild size="sm">
                <Link href="/book">
                  Book a Session
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Continue Learning + Recent Invoices row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Continue Learning */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Continue Learning</CardTitle>
              <Link href="/portal/courses" className="text-xs text-brand-600 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {enrollments.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No courses yet</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/courses">Browse Courses</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {enrollments.map((e) => (
                  <Link key={e.id} href={`/portal/courses/${e.course.slug}`}>
                    <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                      <GraduationCap className="h-5 w-5 shrink-0 text-brand-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{e.course.title}</p>
                        <ProgressBar value={e.progressPercent} className="mt-1.5" />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {e.progressPercent}%
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Invoices</CardTitle>
              <Link href="/portal/invoices" className="text-xs text-brand-600 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium font-mono">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(inv.createdAt), "d MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium">
                        R{(inv.totalCents / 100).toFixed(2)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                          : inv.status === "overdue"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300"
                      }`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/book", title: "Book a Session", desc: "Schedule your next session", icon: CalendarDays },
          { href: "/courses", title: "Browse Courses", desc: "Self-paced learning", icon: GraduationCap },
          { href: "/portal/purchases", title: "My Purchases", desc: "Orders & downloads", icon: FileDown },
          { href: "/portal/settings", title: "Account Settings", desc: "Profile & preferences", icon: Clock },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-start gap-3 pt-5">
                <item.icon className="h-5 w-5 shrink-0 text-brand-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Onboarding progress card */}
      {student.onboardingStep < 3 && (
        <Card className="border-brand-200 bg-brand-50/50">
          <CardHeader>
            <CardTitle className="text-base">Complete Your Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressBar
              value={Math.round((student.onboardingStep / 3) * 100)}
              size="md"
            />
            <p className="text-sm text-muted-foreground">
              {student.onboardingStep === 0 &&
                "Tell us about yourself to get started"}
              {student.onboardingStep === 1 &&
                "Share what you've been experiencing"}
              {student.onboardingStep === 2 &&
                "Review and acknowledge our commitment agreement"}
            </p>
            <Button asChild size="sm">
              <Link
                href={`/portal/onboarding?step=${student.onboardingStep + 1}`}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: typeof CalendarDays;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{value}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
