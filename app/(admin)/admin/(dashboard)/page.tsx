export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, GraduationCap, Quote, CalendarDays, UserCheck, ShoppingCart, Gift } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";

export default async function AdminDashboard() {
  const { adminUser } = await getAuthenticatedAdmin();

  const [
    pageCount,
    courseCount,
    testimonialCount,
    upcomingBookings,
    studentCount,
    revenue,
    pendingGifts,
  ] = await Promise.all([
    prisma.page.count(),
    prisma.course.count(),
    prisma.testimonial.count(),
    prisma.booking.count({
      where: {
        status: { in: ["pending", "confirmed"] },
        date: { gte: new Date() },
      },
    }),
    prisma.student.count(),
    prisma.order.aggregate({
      where: { status: "paid" },
      _sum: { totalCents: true },
    }),
    prisma.gift.count({ where: { status: "pending" } }),
  ]);

  const stats = [
    {
      label: "Students",
      value: studentCount,
      icon: UserCheck,
      href: "/admin/students",
    },
    {
      label: "Revenue",
      value: formatPrice(revenue._sum.totalCents || 0),
      icon: ShoppingCart,
      href: "/admin/orders",
    },
    {
      label: "Upcoming Bookings",
      value: upcomingBookings,
      icon: CalendarDays,
      href: "/admin/bookings",
    },
    {
      label: "Pending Gifts",
      value: pendingGifts,
      icon: Gift,
      href: "/admin/gifts",
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
      label: "Testimonials",
      value: testimonialCount,
      icon: Quote,
      href: "/admin/testimonials",
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/pages">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="pt-6">
              <p className="font-medium">Edit Homepage</p>
              <p className="text-sm text-muted-foreground">
                Update hero, content sections, and CTAs
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/courses">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="pt-6">
              <p className="font-medium">Manage Courses</p>
              <p className="text-sm text-muted-foreground">
                Add, edit, or publish courses
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/testimonials">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="pt-6">
              <p className="font-medium">Manage Testimonials</p>
              <p className="text-sm text-muted-foreground">
                Add and feature client reviews
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/bookings">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="pt-6">
              <p className="font-medium">View Bookings</p>
              <p className="text-sm text-muted-foreground">
                Manage session bookings and availability
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
