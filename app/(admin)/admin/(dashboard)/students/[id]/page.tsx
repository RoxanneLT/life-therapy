export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, GraduationCap, ShoppingCart, Coins } from "lucide-react";
import { grantCreditsAction, grantModuleAccessAction } from "./actions";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("super_admin");

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: { course: { select: { title: true, slug: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      orders: {
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      creditBalance: true,
      creditTransactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      certificates: {
        include: { course: { select: { title: true } } },
      },
      moduleAccess: {
        include: {
          module: {
            select: { standaloneTitle: true, title: true, course: { select: { title: true } } },
          },
        },
        orderBy: { grantedAt: "desc" },
      },
    },
  });

  if (!student) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/students">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {student.firstName} {student.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </div>
        {student.mustChangePassword && (
          <Badge variant="outline">Temp Password</Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Enrollments
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{student.enrollments.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Orders
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{student.orders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Session Credits
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {student.creditBalance?.balance ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grant Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grant Session Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={grantCreditsAction} className="flex items-end gap-3">
            <input type="hidden" name="studentId" value={student.id} />
            <div>
              <label htmlFor="amount" className="text-xs text-muted-foreground">
                Credits
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                max="100"
                defaultValue="1"
                className="mt-1 block w-20 rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label
                htmlFor="description"
                className="text-xs text-muted-foreground"
              >
                Reason
              </label>
              <input
                id="description"
                name="description"
                type="text"
                defaultValue="Admin grant"
                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" size="sm">
              Grant
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          {student.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrollments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Enrolled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">
                      {e.course.title}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-brand-500"
                            style={{ width: `${e.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-xs">{e.progressPercent}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {e.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(e.enrolledAt), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Module Access (Short Courses) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Module Access (Short Courses)</CardTitle>
        </CardHeader>
        <CardContent>
          {student.moduleAccess.length === 0 ? (
            <p className="text-sm text-muted-foreground">No module access.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Granted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.moduleAccess.map((ma) => (
                  <TableRow key={ma.id}>
                    <TableCell className="font-medium">
                      {ma.module.standaloneTitle || ma.module.title}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ma.module.course.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ma.source}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPrice(ma.pricePaid)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(ma.grantedAt), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Grant module access form */}
          <form action={grantModuleAccessAction} className="mt-4 flex items-end gap-3 border-t pt-4">
            <input type="hidden" name="studentId" value={student.id} />
            <div className="flex-1">
              <label htmlFor="moduleId" className="text-xs text-muted-foreground">
                Module ID
              </label>
              <input
                id="moduleId"
                name="moduleId"
                type="text"
                placeholder="Paste module ID"
                required
                className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <Button type="submit" size="sm">
              Grant Access
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Orders */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {student.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="font-medium text-brand-600 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPrice(o.totalCents)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(o.createdAt), "d MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Credit Transactions */}
      {student.creditTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance After</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.creditTransactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={
                        tx.type === "used"
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {tx.type === "used" ? "-" : "+"}
                      {tx.amount}
                    </TableCell>
                    <TableCell>{tx.balanceAfter}</TableCell>
                    <TableCell className="text-sm">{tx.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(tx.createdAt), "d MMM HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
