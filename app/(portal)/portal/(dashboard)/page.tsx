export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Award, Coins } from "lucide-react";
import Link from "next/link";

export default async function PortalDashboardPage() {
  const { student } = await requirePasswordChanged();

  const [enrollmentCount, certificateCount, creditBalance] = await Promise.all([
    prisma.enrollment.count({ where: { studentId: student.id } }),
    prisma.certificate.count({ where: { studentId: student.id } }),
    prisma.sessionCreditBalance.findUnique({
      where: { studentId: student.id },
    }),
  ]);

  const stats = [
    {
      label: "My Courses",
      value: enrollmentCount,
      icon: GraduationCap,
      href: "/portal/courses",
    },
    {
      label: "Certificates",
      value: certificateCount,
      icon: Award,
      href: "/portal/certificates",
    },
    {
      label: "Session Credits",
      value: creditBalance?.balance ?? 0,
      icon: Coins,
      href: "/portal/credits",
    },
  ];

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {enrollmentCount === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="font-heading text-lg font-semibold">
              No courses yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse our course catalog to get started on your journey.
            </p>
            <Link
              href="/courses"
              className="mt-4 inline-flex items-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Browse Courses
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
