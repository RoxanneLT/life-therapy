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
    enrollmentCount,
    moduleAccessCount,
    digitalProductCount,
    nextBooking,
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
    prisma.enrollment.count({ where: { studentId: student.id } }),
    prisma.moduleAccess.count({ where: { studentId: student.id } }),
    prisma.digitalProductAccess.count({ where: { studentId: student.id } }),
    prisma.booking.findFirst({
      where: {
        studentId: student.id,
        date: { gte: today },
        status: { in: ["pending", "confirmed"] },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  const totalCourseCount = enrollmentCount + moduleAccessCount;
  const currentBalance = creditBalance?.balance ?? 0;
  const isSessionsClient = upcomingBookingsCount > 0 || currentBalance > 0 || !!nextBooking;

  const stats = isSessionsClient
    ? [
        {
          label: "Upcoming Sessions",
          value: upcomingBookingsCount,
          icon: CalendarDays,
          href: "/portal/bookings",
        },
        {
          label: "Session Credits",
          value: currentBalance,
          icon: Coins,
          href: "/portal/credits",
        },
        {
          label: "My Courses",
          value: totalCourseCount,
          icon: GraduationCap,
          href: "/portal/courses",
        },
      ]
    : [
        {
          label: "My Courses",
          value: totalCourseCount,
          icon: GraduationCap,
          href: "/portal/courses",
        },
        {
          label: "My Purchases",
          value: digitalProductCount,
          icon: ShoppingBag,
          href: "/portal/purchases",
        },
      ];

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
      <div className={`grid gap-4 ${isSessionsClient ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
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

      {/* Next Session card — sessions clients only */}
      {isSessionsClient && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Next Session</CardTitle>
          </CardHeader>
          <CardContent>
            {nextBooking && sessionConfig ? (
              <div className="flex items-center justify-between gap-4">
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
                        Join Session
                      </a>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link href="/portal/book">Book a Session</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/portal/bookings">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center">
                <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No upcoming sessions</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/portal/book">Book a Session</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
