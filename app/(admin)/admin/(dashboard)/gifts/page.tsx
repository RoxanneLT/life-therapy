export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { format } from "date-fns";
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
import { Gift } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { resendGiftEmailAction } from "./actions";
import { GIFT_STATUS_BADGE } from "@/lib/status-styles";

export default async function GiftsPage() {
  await requireRole("super_admin");

  const gifts = await prisma.gift.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      buyer: { select: { firstName: true, lastName: true } },
      course: { select: { title: true } },
      hybridPackage: { select: { title: true } },
    },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gifts"
        description={`${gifts.length} gift records`}
      />

      {gifts.length === 0 ? (
        <EmptyState
          icon={Gift}
          message="No gifts yet."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gifts.map((g) => {
                const itemTitle =
                  g.course?.title ||
                  g.hybridPackage?.title ||
                  (g.creditAmount
                    ? `${g.creditAmount} Credits`
                    : "Gift");
                return (
                  <TableRow key={g.id}>
                    <TableCell className="text-sm">
                      {g.buyer.firstName} {g.buyer.lastName}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{g.recipientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {g.recipientEmail}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{itemTitle}</TableCell>
                    <TableCell>
                      <Badge
                        className={STATUS_STYLES[g.status] || ""}
                        variant="outline"
                      >
                        {g.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.deliveryDate
                        ? format(new Date(g.deliveryDate), "d MMM yyyy")
                        : "Immediate"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(g.createdAt), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {(g.status === "pending" || g.status === "delivered") && (
                        <form action={resendGiftEmailAction}>
                          <input type="hidden" name="giftId" value={g.id} />
                          <Button variant="ghost" size="sm" type="submit">
                            Resend
                          </Button>
                        </form>
                      )}
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
