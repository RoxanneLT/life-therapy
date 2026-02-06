"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CouponType } from "@/lib/generated/prisma/client";

export async function createCouponAction(formData: FormData) {
  await requireRole("super_admin");

  const code = (formData.get("code") as string).trim().toUpperCase();
  const type = formData.get("type") as CouponType;
  const value = parseInt(formData.get("value") as string, 10);
  const maxUses = formData.get("maxUses")
    ? parseInt(formData.get("maxUses") as string, 10)
    : null;
  const expiresAt = formData.get("expiresAt")
    ? new Date(formData.get("expiresAt") as string)
    : null;
  const minOrderCents = formData.get("minOrderCents")
    ? parseInt(formData.get("minOrderCents") as string, 10)
    : null;

  if (!code || !type || !value) {
    throw new Error("Code, type, and value are required");
  }

  await prisma.coupon.create({
    data: {
      code,
      type,
      value,
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
  const maxUses = formData.get("maxUses")
    ? parseInt(formData.get("maxUses") as string, 10)
    : null;
  const expiresAt = formData.get("expiresAt")
    ? new Date(formData.get("expiresAt") as string)
    : null;
  const minOrderCents = formData.get("minOrderCents")
    ? parseInt(formData.get("minOrderCents") as string, 10)
    : null;
  const isActive = formData.get("isActive") === "true";

  await prisma.coupon.update({
    where: { id },
    data: {
      code,
      type,
      value,
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
