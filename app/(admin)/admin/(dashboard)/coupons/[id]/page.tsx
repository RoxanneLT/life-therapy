export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { EditCouponForm } from "./edit-coupon-form";

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("super_admin");

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) notFound();

  const serialized = {
    id: coupon.id,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    valueUsd: coupon.valueUsd,
    valueEur: coupon.valueEur,
    valueGbp: coupon.valueGbp,
    maxUses: coupon.maxUses,
    expiresAt: coupon.expiresAt
      ? format(new Date(coupon.expiresAt), "yyyy-MM-dd")
      : null,
    minOrderCents: coupon.minOrderCents,
    isActive: coupon.isActive,
    usedCount: coupon.usedCount,
  };

  return <EditCouponForm coupon={serialized} />;
}
