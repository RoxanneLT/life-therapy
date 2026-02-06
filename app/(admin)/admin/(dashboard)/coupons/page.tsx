export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { format } from "date-fns";
import Link from "next/link";
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
import { Plus, Tag } from "lucide-react";

export default async function CouponsPage() {
  await requireRole("super_admin");

  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-muted-foreground">
            {coupons.length} coupon codes
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/coupons/new">
            <Plus className="mr-2 h-4 w-4" />
            New Coupon
          </Link>
        </Button>
      </div>

      {coupons.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Tag className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No coupons yet.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-center">Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const isExpired = c.expiresAt && new Date(c.expiresAt) < new Date();
                const isMaxed = c.maxUses !== null && c.usedCount >= c.maxUses;
                const status = !c.isActive
                  ? "inactive"
                  : isExpired
                    ? "expired"
                    : isMaxed
                      ? "maxed"
                      : "active";

                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/admin/coupons/${c.id}`}
                        className="font-mono font-medium text-brand-600 hover:underline"
                      >
                        {c.code}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{c.type}</TableCell>
                    <TableCell className="text-sm">
                      {c.type === "percentage"
                        ? `${c.value}%`
                        : `R${(c.value / 100).toFixed(0)}`}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {c.usedCount}
                      {c.maxUses !== null ? `/${c.maxUses}` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          status === "active"
                            ? "bg-green-100 text-green-800"
                            : status === "expired"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                        }
                      >
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.expiresAt
                        ? format(new Date(c.expiresAt), "d MMM yyyy")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/coupons/${c.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
