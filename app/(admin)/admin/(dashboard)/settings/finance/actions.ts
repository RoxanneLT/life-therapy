"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

export async function updateFinanceSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin");

  const raw = Object.fromEntries(formData.entries());

  const toNullable = (val: FormDataEntryValue | undefined): string | null => {
    if (!val || val === "") return null;
    return val as string;
  };

  const toInt = (val: FormDataEntryValue | undefined): number | null => {
    if (!val || val === "") return null;
    const n = Number.parseInt(val as string, 10);
    return Number.isNaN(n) ? null : n;
  };

  const postpaidBillingDay = raw.postpaidBillingDay
    ? Number.parseInt(raw.postpaidBillingDay as string, 10) || 20
    : 20;
  const postpaidDueDay = raw.postpaidDueDay
    ? Number.parseInt(raw.postpaidDueDay as string, 10) || 28
    : 28;

  if (postpaidDueDay <= postpaidBillingDay) {
    return { success: false, error: "Due day must be after billing day" };
  }

  const data = {
    // Business details
    businessRegistrationNumber: toNullable(raw.businessRegistrationNumber),
    businessAddress: toNullable(raw.businessAddress),
    invoicePrefix: toNullable(raw.invoicePrefix) || "LT",

    // VAT
    vatRegistered: raw.vatRegistered === "true",
    vatNumber: toNullable(raw.vatNumber),
    vatPercent: raw.vatPercent ? Number.parseFloat(raw.vatPercent as string) || 15 : 15,

    // Session pricing
    sessionPriceIndividualZar: toInt(raw.sessionPriceIndividualZar),
    sessionPriceIndividualUsd: toInt(raw.sessionPriceIndividualUsd),
    sessionPriceIndividualEur: toInt(raw.sessionPriceIndividualEur),
    sessionPriceIndividualGbp: toInt(raw.sessionPriceIndividualGbp),
    sessionPriceCouplesZar: toInt(raw.sessionPriceCouplesZar),
    sessionPriceCouplesUsd: toInt(raw.sessionPriceCouplesUsd),
    sessionPriceCouplesEur: toInt(raw.sessionPriceCouplesEur),
    sessionPriceCouplesGbp: toInt(raw.sessionPriceCouplesGbp),

    // Billing schedule
    postpaidBillingDay,
    postpaidDueDay,

    // Banking
    bankName: toNullable(raw.bankName),
    bankAccountHolder: toNullable(raw.bankAccountHolder),
    bankAccountNumber: toNullable(raw.bankAccountNumber),
    bankBranchCode: toNullable(raw.bankBranchCode),
  };

  const existing = await prisma.siteSetting.findFirst();
  if (existing) {
    await prisma.siteSetting.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.siteSetting.create({ data });
  }

  revalidatePath("/admin/settings/finance");
  return { success: true };
}
