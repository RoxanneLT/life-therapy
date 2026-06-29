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
import { Plus, Tag, Gift } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils";
import { resendGiftEmailAction } from "../gifts/actions";
import { GIFT_STATUS_BADGE } from "@/lib/status-styles";

type Tab = "coupons" | "gifts";

const TABS: { id: Tab; label: string; href: string }[] = [
  { id: "coupons", label: "Coupons", href: "/admin/coupons" },
  { id: "gifts", label: "Gifts", href: "/admin/coupons?tab=gifts" },
];

export default async function CouponsGiftsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("super_admin");
  const { tab } = await searchParams;
  const active: Tab = tab === "gifts" ? "gifts" : "coupons";

  const coupons = active === "coupons"
    ? await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } })
    : [];

  const gifts = active === "gifts"
    ? await prisma.gift.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          buyer: { select: { firstName: true, lastName: true } },
          course: { select: { title: true } },
          hybridPackage: { select: { title: true } },
        },
        take: 100,
      })
    : [];

  const description =
    active === "coupons"
      ? `${coupons.length} coupon code${coupons.length === 1 ? "" : "s"}`
      : `${gifts.length} gift record${gifts.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coupons & Gifts"
        description={description}
        action={
          active === "coupons" ? (
            <Button asChild>
              <Link href="/admin/coupons/new">
                <Plus className="mr-2 h-4 w-4" />
                New Coupon
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px",
              active === t.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Coupons tab */}
      {active === "coupons" &&
        (coupons.length === 0 ? (
          <EmptyState icon={Tag} message="No coupons yet." />
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
                        {c.type === "percentage" ? (
                          `${c.value}%`
                        ) : (
                          <span
                            title={[
                              `ZAR: R${(c.value / 100).toFixed(0)}`,
                              c.valueUsd != null ? `USD: $${(c.valueUsd / 100).toFixed(0)}` : null,
                              c.valueEur != null ? `EUR: €${(c.valueEur / 100).toFixed(0)}` : null,
                              c.valueGbp != null ? `GBP: £${(c.valueGbp / 100).toFixed(0)}` : null,
                            ]
                              .filter(Boolean)
                              .join(", ")}
                          >
                            R{(c.value / 100).toFixed(0)}
                            {(c.valueUsd != null || c.valueEur != null || c.valueGbp != null) && (
                              <span className="ml-1 text-xs text-muted-foreground">+3</span>
                            )}
                          </span>
                        )}
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
                        {c.expiresAt ? format(new Date(c.expiresAt), "d MMM yyyy") : "Never"}
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
        ))}

      {/* Gifts tab (info only) */}
      {active === "gifts" &&
        (gifts.length === 0 ? (
          <EmptyState icon={Gift} message="No gifts yet." />
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
                    (g.creditAmount ? `${g.creditAmount} Credits` : "Gift");
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="text-sm">
                        {g.buyer.firstName} {g.buyer.lastName}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{g.recipientName}</p>
                          <p className="text-xs text-muted-foreground">{g.recipientEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{itemTitle}</TableCell>
                      <TableCell>
                        <Badge className={GIFT_STATUS_BADGE[g.status] || ""} variant="outline">
                          {g.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {g.deliveryDate ? format(new Date(g.deliveryDate), "d MMM yyyy") : "Immediate"}
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
        ))}
    </div>
  );
}
