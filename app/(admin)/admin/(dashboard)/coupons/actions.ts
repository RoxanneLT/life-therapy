"use server";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CouponType } from "@/lib/generated/prisma/client";

interface ActionState {
  error?: string;
}

function parseOptionalInt(formData: FormData, key: string): number | null {
  const raw = formData.get(key) as string | null;
  if (!raw || raw.trim() === "") return null;
  const val = parseInt(raw, 10);
  return isNaN(val) ? null : val;
}

export async function createCouponAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
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

  if (!code || !type || Number.isNaN(value) || value <= 0) {
    return { error: "Code, type, and a positive value are required." };
  }

  try {
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
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { error: `A coupon with code "${code}" already exists.` };
    }
    console.error("[create-coupon]", err);
    return { error: "Failed to create coupon. Please try again." };
  }

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function updateCouponAction(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
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

  if (!code || !type || Number.isNaN(value) || value <= 0) {
    return { error: "Code, type, and a positive value are required." };
  }

  try {
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
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { error: `A coupon with code "${code}" already exists.` };
    }
    console.error("[update-coupon]", err);
    return { error: "Failed to update coupon. Please try again." };
  }

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function deleteCouponAction(formData: FormData) {
  await requireRole("super_admin");

  const id = formData.get("id") as string;

  try {
    await prisma.coupon.delete({ where: { id } });
  } catch (err) {
    console.error("[delete-coupon]", err);
    return;
  }

  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}
