export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShoppingCart } from "lucide-react";
import type { OrderStatus } from "@/lib/generated/prisma/client";

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
  partially_refunded: "bg-orange-100 text-orange-800",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireRole("super_admin");
  const params = await searchParams;

  const where = params.status
    ? { status: params.status as OrderStatus }
    : {};

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        student: { select: { firstName: true, lastName: true, email: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  const totalRevenue = await prisma.order.aggregate({
    where: { status: "paid" },
    _sum: { totalCents: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Orders</h1>
        <p className="text-sm text-muted-foreground">
          Total revenue: {formatPrice(totalRevenue._sum.totalCents || 0)}
        </p>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/orders">
          <Badge variant={!params.status ? "default" : "outline"}>
            All ({orders.length})
          </Badge>
        </Link>
        {counts.map((c) => (
          <Link key={c.status} href={`/admin/orders?status=${c.status}`}>
            <Badge
              variant={params.status === c.status ? "default" : "outline"}
            >
              {c.status} ({c._count})
            </Badge>
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <ShoppingCart className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No orders yet.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.student.firstName} {o.student.lastName}
                  </TableCell>
                  <TableCell className="text-sm">
                    {o.items.length} item{o.items.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_STYLES[o.status] || ""}
                      variant="outline"
                    >
                      {o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(o.totalCents)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(o.createdAt), "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
