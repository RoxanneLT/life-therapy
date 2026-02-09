"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CouponType } from "@/lib/generated/prisma/client";

function parseOptionalInt(formData: FormData, key: string): number | null {
  const raw = formData.get(key) as string | null;
  if (!raw || raw.trim() === "") return null;
  const val = parseInt(raw, 10);
  return isNaN(val) ? null : val;
}

export async function createCouponAction(formData: FormData) {
  await requireRole("super_admin");

  const code = (formData.get("code") as string).trim().toUpperCase();
  const type = formData.get("type") as CouponType;
  const value = parseInt(formData.get("value") as string, 10);
  const maxUses = parseOptionalInt(formData, "maxUses");
  const expiresAt = formData.get("expiresAt")
    ? new Date(formData.get("expiresAt") as string)
    : null;
  const minOrderCents = parseOptionalInt(formData, "minOrderCents");
  const valueUsd = parseOptionalInt(formData, "valueUsd");
  const valueEur = parseOptionalInt(formData, "valueEur");
  const valueGbp = parseOptionalInt(formData, "valueGbp");

  if (!code || !type || !value) {
    throw new Error("Code, type, and value are required");
  }

  await prisma.coupon.create({
    data: {
      code,
      type,
      value,
      valueUsd: type === "fixed_amount" ? valueUsd : null,
      valueEur: type === "fixed_amount" ? valueEur : null,
      valueGbp: type === "fixed_amount" ? valueGbp : null,
      maxUses,
      expiresAt,
      minOrderCents,
      isActive: true,
    },
  });

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function updateCouponAction(formData: FormData) {
  await requireRole("super_admin");

  const id = formData.get("id") as string;
  const code = (formData.get("code") as string).trim().toUpperCase();
  const type = formData.get("type") as CouponType;
  const value = parseInt(formData.get("value") as string, 10);
  const maxUses = parseOptionalInt(formData, "maxUses");
  const expiresAt = formData.get("expiresAt")
    ? new Date(formData.get("expiresAt") as string)
    : null;
  const minOrderCents = parseOptionalInt(formData, "minOrderCents");
  const valueUsd = parseOptionalInt(formData, "valueUsd");
  const valueEur = parseOptionalInt(formData, "valueEur");
  const valueGbp = parseOptionalInt(formData, "valueGbp");
  const isActive = formData.get("isActive") === "true";

  await prisma.coupon.update({
    where: { id },
    data: {
      code,
      type,
      value,
      valueUsd: type === "fixed_amount" ? valueUsd : null,
      valueEur: type === "fixed_amount" ? valueEur : null,
      valueGbp: type === "fixed_amount" ? valueGbp : null,
      maxUses,
      expiresAt,
      minOrderCents,
      isActive,
    },
  });

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function deleteCouponAction(formData: FormData) {
  await requireRole("super_admin");

  const id = formData.get("id") as string;
  await prisma.coupon.delete({ where: { id } });

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}
