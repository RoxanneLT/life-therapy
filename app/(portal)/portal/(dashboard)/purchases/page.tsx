export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/portal/progress-bar";
import { ShoppingBag, GraduationCap, FileDown, Coins, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

export default async function PurchasesPage() {
  const { student } = await requirePasswordChanged();

  const [orders, enrollments, digitalAccess, creditBalance] = await Promise.all([
    prisma.order.findMany({
      where: { studentId: student.id, status: "paid" },
      include: {
        items: {
          include: {
            course: { select: { title: true } },
            hybridPackage: { select: { title: true } },
            module: { select: { title: true } },
            digitalProduct: { select: { title: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),
    prisma.enrollment.findMany({
      where: { studentId: student.id },
      include: { course: { select: { title: true, slug: true } } },
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.digitalProductAccess.findMany({
      where: { studentId: student.id },
      include: { digitalProduct: { select: { title: true, slug: true } } },
      orderBy: { grantedAt: "desc" },
    }),
    prisma.sessionCreditBalance.findUnique({
      where: { studentId: student.id },
    }),
  ]);

  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-bold">My Purchases</h1>

      {/* Session Packages / Orders */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          Orders
        </h2>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No orders yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        Order #{order.orderNumber}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.paidAt
                          ? format(new Date(order.paidAt), "d MMM yyyy")
                          : "Pending"}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {order.items.map((item) => (
                          <li key={item.id} className="text-xs text-muted-foreground">
                            {item.course?.title ||
                              item.hybridPackage?.title ||
                              item.module?.title ||
                              item.digitalProduct?.title ||
                              item.description}
                            {item.quantity > 1 && ` × ${item.quantity}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      R{(order.totalCents / 100).toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {(creditBalance?.balance ?? 0) > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="h-4 w-4" />
            <span>
              You have <span className="font-medium text-foreground">{creditBalance!.balance}</span>{" "}
              session credit{creditBalance!.balance !== 1 && "s"} remaining.
            </span>
            <Link href="/portal/credits" className="text-brand-600 hover:underline">
              View credits &rarr;
            </Link>
          </div>
        )}
      </section>

      {/* Course Enrollments */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <GraduationCap className="h-5 w-5 text-muted-foreground" />
          Courses
        </h2>
        {enrollments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No courses yet.{" "}
              <Link href="/courses" className="text-brand-600 hover:underline">
                Browse courses
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <Link key={e.id} href={`/portal/courses/${e.course.slug}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.course.title}</p>
                      <ProgressBar
                        value={e.progressPercent}
                        showLabel
                        className="mt-2"
                      />
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Digital Products */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <FileDown className="h-5 w-5 text-muted-foreground" />
          Digital Products
        </h2>
        {digitalAccess.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No digital products yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {digitalAccess.map((da) => (
              <Link key={da.id} href={`/portal/downloads`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-medium">
                        {da.digitalProduct.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Granted {format(new Date(da.grantedAt), "d MMM yyyy")}
                      </p>
                    </div>
                    <FileDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
