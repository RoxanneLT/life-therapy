export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, GraduationCap, CalendarDays, UserCheck, ShoppingCart, Cloud, PackageOpen, ShoppingBag } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { getBookingsByMonth, getRevenueByMonth } from "@/lib/dashboard-queries";
import { BookingsChart } from "@/components/admin/bookings-chart";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { YearSelector } from "@/components/admin/year-selector";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { adminUser } = await getAuthenticatedAdmin();
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = params.year ? parseInt(params.year, 10) : currentYear;
  const validYear = year >= currentYear - 2 && year <= currentYear + 2 ? year : currentYear;

  const [
    pageCount,
    courseCount,
    digitalProductCount,
    packageCount,
    upcomingBookings,
    studentCount,
    revenue,
    bunnyBalance,
    bookingsByMonth,
    revenueByMonth,
  ] = await Promise.all([
    prisma.page.count(),
    prisma.course.count(),
    prisma.digitalProduct.count(),
    prisma.hybridPackage.count(),
    prisma.booking.count({
      where: {
        status: { in: ["pending", "confirmed"] },
        date: { gte: new Date() },
      },
    }),
    prisma.student.count({ where: { clientStatus: "active" } }),
    prisma.invoice.aggregate({
      where: { status: "paid", paidAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      _sum: { paidAmountCents: true },
    }),
    (async () => {
      const key = process.env.BUNNY_ACCOUNT_API_KEY;
      if (!key) return null;
      try {
        const res = await fetch("https://api.bunny.net/billing", {
          headers: { AccessKey: key },
          next: { revalidate: 3600 },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return { balance: data.Balance as number, charges: data.ThisMonthCharges as number };
      } catch { return null; }
    })(),
    getBookingsByMonth(validYear),
    getRevenueByMonth(validYear),
  ]);

  const stats = [
    {
      label: "Active Clients",
      value: studentCount,
      icon: UserCheck,
      href: "/admin/clients?status=active",
    },
    {
      label: "Revenue (30 days)",
      value: formatPrice(revenue._sum.paidAmountCents || 0),
      icon: ShoppingCart,
      href: "/admin/invoices",
    },
    {
      label: "Upcoming Bookings",
      value: upcomingBookings,
      icon: CalendarDays,
      href: "/admin/bookings",
    },
    {
      label: "Bunny.net Balance",
      value: bunnyBalance ? `$${bunnyBalance.balance.toFixed(2)}` : "—",
      icon: Cloud,
      href: "/admin/settings",
    },
    {
      label: "Pages",
      value: pageCount,
      icon: FileText,
      href: "/admin/pages",
    },
    {
      label: "Courses",
      value: courseCount,
      icon: GraduationCap,
      href: "/admin/courses",
    },
    {
      label: "Digital Products",
      value: digitalProductCount,
      icon: ShoppingBag,
      href: "/admin/digital-products",
    },
    {
      label: "Packages",
      value: packageCount,
      icon: PackageOpen,
      href: "/admin/packages",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          Welcome back{adminUser.name ? `, ${adminUser.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your Life-Therapy platform content.
        </p>
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
            <CardDescription>Actual payments &amp; estimated from upcoming sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenueByMonth} />
          </CardContent>
        </Card>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/admin/pages", title: "Edit Homepage", desc: "Hero, content & CTAs" },
          { href: "/admin/courses", title: "Manage Courses", desc: "Add, edit, or publish" },
          { href: "/admin/testimonials", title: "Testimonials", desc: "Client reviews" },
          { href: "/admin/bookings", title: "View Bookings", desc: "Sessions & availability" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardContent className="pt-6">
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground truncate">{item.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
