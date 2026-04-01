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

  const postpaidDueDays = raw.postpaidDueDays
    ? Number.parseInt(raw.postpaidDueDays as string, 10) || 7
    : 7;
  const postpaidDueDaysType = (raw.postpaidDueDaysType as string) === "calendar"
    ? "calendar"
    : "business";

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
    postpaidDueDays,
    postpaidDueDaysType,

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
  revalidatePath("/book");
  return { success: true };
}

// ─── Billing Presets ──────────────────────────────────────────

export async function getBillingPresetsAction() {
  await requireRole("super_admin");
  return prisma.billingPreset.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export interface BillingPresetInput {
  id?: string;          // existing presets have an id; new ones don't
  label: string;
  description: string;
  subLine?: string;
  priceCents: number;
  category: string;
  isActive: boolean;
  sortOrder: number;
}

export async function updateBillingPresetsAction(
  presets: BillingPresetInput[],
): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin");

  try {
    // Upsert each preset, delete any that were removed
    const incoming = presets.filter((p) => p.label.trim());
    const incomingIds = incoming.filter((p) => p.id).map((p) => p.id!);

    // Delete rows not in the incoming set
    if (incomingIds.length > 0) {
      await prisma.billingPreset.deleteMany({
        where: { id: { notIn: incomingIds } },
      });
    } else {
      await prisma.billingPreset.deleteMany({});
    }

    for (const p of incoming) {
      if (p.id) {
        await prisma.billingPreset.update({
          where: { id: p.id },
          data: {
            label: p.label.trim(),
            description: p.description.trim(),
            subLine: p.subLine?.trim() || null,
            priceCents: p.priceCents,
            category: p.category,
            isActive: p.isActive,
            sortOrder: p.sortOrder,
          },
        });
      } else {
        await prisma.billingPreset.create({
          data: {
            label: p.label.trim(),
            description: p.description.trim(),
            subLine: p.subLine?.trim() || null,
            priceCents: p.priceCents,
            category: p.category,
            isActive: p.isActive,
            sortOrder: p.sortOrder,
          },
        });
      }
    }

    revalidatePath("/admin/settings/finance");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
