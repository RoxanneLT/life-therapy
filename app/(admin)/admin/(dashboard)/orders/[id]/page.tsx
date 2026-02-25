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
import { ArrowLeft } from "lucide-react";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("super_admin");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      student: { select: { firstName: true, lastName: true, email: true, id: true } },
      items: {
        include: {
          course: { select: { title: true } },
          hybridPackage: { select: { title: true } },
        },
      },
      coupon: { select: { code: true, type: true, value: true } },
      gifts: {
        select: {
          id: true,
          recipientEmail: true,
          recipientName: true,
          status: true,
        },
      },
    },
  });

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {order.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(order.createdAt), "d MMMM yyyy HH:mm")}
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            order.status === "paid"
              ? "bg-green-100 text-green-800"
              : order.status === "refunded"
                ? "bg-gray-100 text-gray-800"
                : "bg-yellow-100 text-yellow-800"
          }
        >
          {order.status}
        </Badge>
      </div>

      {/* Customer info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <strong>
              {order.student.firstName} {order.student.lastName}
            </strong>
          </p>
          <p>{order.student.email}</p>
          <Link
            href={`/admin/students/${order.student.id}`}
            className="text-brand-600 hover:underline"
          >
            View Student Profile
          </Link>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Gift</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.description}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.courseId ? "Course" : "Package"}
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatPrice(item.totalCents)}
                  </TableCell>
                  <TableCell className="text-center">
                    {item.isGift ? (
                      <Badge variant="outline" className="text-xs">
                        Gift
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals */}
          <div className="mt-4 space-y-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPrice(order.subtotalCents)}</span>
            </div>
            {order.discountCents > 0 && (
              <div className="flex justify-between text-green-600">
                <span>
                  Discount
                  {order.coupon && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({order.coupon.code})
                    </span>
                  )}
                </span>
                <span>-{formatPrice(order.discountCents)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatPrice(order.totalCents)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gifts */}
      {order.gifts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gifts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.gifts.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.recipientName}</TableCell>
                    <TableCell>{g.recipientEmail}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {g.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Payment info */}
      {(order.paystackReference || order.paidAt) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {order.paystackReference && (
              <p>
                <span className="text-muted-foreground">Reference: </span>
                <code className="text-xs">{order.paystackReference}</code>
              </p>
            )}
            {order.paidAt && (
              <p>
                <span className="text-muted-foreground">Paid: </span>
                {format(new Date(order.paidAt), "d MMM yyyy HH:mm")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
