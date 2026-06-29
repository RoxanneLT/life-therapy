"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole, getAuthenticatedAdmin } from "@/lib/auth";
import { getSettingsPageVisits } from "@/lib/settings-ui-state";
import { matchSettingsPage } from "@/lib/settings-catalog";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Bump the per-admin visit tally for whichever settings page this path belongs
 *  to. Fire-and-forget from the client usage recorder. */
export async function recordSettingsVisitAction(pathname: string) {
  const page = matchSettingsPage(pathname);
  if (!page) return;
  try {
    const { adminUser } = await getAuthenticatedAdmin();
    const visits = await getSettingsPageVisits(adminUser.id);
    visits[page.href] = (visits[page.href] ?? 0) + 1;
    await prisma.adminUser.update({
      where: { id: adminUser.id },
      data: { settingsPageVisits: visits as Prisma.InputJsonValue },
    });
  } catch {
    // best-effort — never block navigation
  }
}

export async function updateSettings(formData: FormData) {
  await requireRole("super_admin");

  const raw = Object.fromEntries(formData.entries());

  // Parse business hours from JSON string
  let businessHours = undefined;
  if (raw.businessHours) {
    try {
      businessHours = JSON.parse(raw.businessHours as string);
    } catch {
      // Keep existing if parse fails
    }
  }

  // Parse footer office branches from JSON string. Drop fully-blank rows so a
  // removed/empty office never renders an empty gap in the footer.
  let branchAddresses = undefined;
  if (raw.branchAddresses) {
    try {
      const parsed = JSON.parse(raw.branchAddresses as string);
      branchAddresses = Array.isArray(parsed)
        ? parsed.filter((b) =>
            b &&
            ["buildingName", "streetAddress", "suburb", "town", "postcode", "province"].some(
              (k) => typeof b[k] === "string" && b[k].trim() !== "",
            ),
          )
        : [];
    } catch {
      // Keep existing if parse fails
    }
  }

  // Build the update object. Only include fields actually present in this
  // submission so a per-group form (Branding, Contact, …) updates ONLY its own
  // fields and never clobbers settings owned by another group.
  const toNullable = (val: FormDataEntryValue | undefined): string | null => {
    if (!val || val === "") return null;
    return val as string;
  };
  const has = (key: string) => formData.has(key);

  const data = {
    ...(has("siteName") ? { siteName: (raw.siteName as string) || "Life-Therapy" } : {}),
    ...(has("tagline") ? { tagline: toNullable(raw.tagline) } : {}),
    ...(has("logoUrl") ? { logoUrl: toNullable(raw.logoUrl) } : {}),
    ...(has("email") ? { email: toNullable(raw.email) } : {}),
    ...(has("phone") ? { phone: toNullable(raw.phone) } : {}),
    ...(has("whatsappNumber") ? { whatsappNumber: toNullable(raw.whatsappNumber) } : {}),
    ...(businessHours !== undefined ? { businessHours } : {}),
    ...(has("locationText") ? { locationText: toNullable(raw.locationText) } : {}),
    ...(branchAddresses !== undefined ? { branchAddresses } : {}),
    ...(has("facebookUrl") ? { facebookUrl: toNullable(raw.facebookUrl) } : {}),
    ...(has("linkedinUrl") ? { linkedinUrl: toNullable(raw.linkedinUrl) } : {}),
    ...(has("instagramUrl") ? { instagramUrl: toNullable(raw.instagramUrl) } : {}),
    ...(has("tiktokUrl") ? { tiktokUrl: toNullable(raw.tiktokUrl) } : {}),
    ...(has("youtubeUrl") ? { youtubeUrl: toNullable(raw.youtubeUrl) } : {}),
    ...(has("metaTitle") ? { metaTitle: toNullable(raw.metaTitle) } : {}),
    ...(has("metaDescription") ? { metaDescription: toNullable(raw.metaDescription) } : {}),
    ...(has("ogImageUrl") ? { ogImageUrl: toNullable(raw.ogImageUrl) } : {}),
    ...(has("googleAnalyticsId") ? { googleAnalyticsId: toNullable(raw.googleAnalyticsId) } : {}),
    ...(has("smtpFromName") ? { smtpFromName: toNullable(raw.smtpFromName) } : {}),
    ...(has("smtpFromEmail") ? { smtpFromEmail: toNullable(raw.smtpFromEmail) } : {}),
    ...(has("copyrightText") ? { copyrightText: toNullable(raw.copyrightText) } : {}),
    ...(has("footerTagline") ? { footerTagline: toNullable(raw.footerTagline) } : {}),
  };

  // Upsert: update existing or create new
  const existing = await prisma.siteSetting.findFirst();
  if (existing) {
    await prisma.siteSetting.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.siteSetting.create({ data });
  }

  revalidatePath("/admin/settings", "layout");
  revalidatePath("/");
}
