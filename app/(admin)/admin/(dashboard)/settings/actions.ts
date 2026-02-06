"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";

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

  // Parse smtpPort as number or null
  const smtpPort = raw.smtpPort ? parseInt(raw.smtpPort as string, 10) : null;

  // Build data object, converting empty strings to null
  const toNullable = (val: FormDataEntryValue | undefined): string | null => {
    if (!val || val === "") return null;
    return val as string;
  };

  const data = {
    siteName: (raw.siteName as string) || "Life-Therapy",
    tagline: toNullable(raw.tagline),
    logoUrl: toNullable(raw.logoUrl),
    email: toNullable(raw.email),
    phone: toNullable(raw.phone),
    whatsappNumber: toNullable(raw.whatsappNumber),
    businessHours: businessHours ?? undefined,
    locationText: toNullable(raw.locationText),
    facebookUrl: toNullable(raw.facebookUrl),
    linkedinUrl: toNullable(raw.linkedinUrl),
    instagramUrl: toNullable(raw.instagramUrl),
    tiktokUrl: toNullable(raw.tiktokUrl),
    youtubeUrl: toNullable(raw.youtubeUrl),
    metaTitle: toNullable(raw.metaTitle),
    metaDescription: toNullable(raw.metaDescription),
    ogImageUrl: toNullable(raw.ogImageUrl),
    googleAnalyticsId: toNullable(raw.googleAnalyticsId),
    mailchimpApiKey: toNullable(raw.mailchimpApiKey),
    mailchimpAudienceId: toNullable(raw.mailchimpAudienceId),
    mailchimpServer: toNullable(raw.mailchimpServer),
    smtpHost: toNullable(raw.smtpHost),
    smtpPort: isNaN(smtpPort as number) ? null : smtpPort,
    smtpUser: toNullable(raw.smtpUser),
    smtpPass: toNullable(raw.smtpPass),
    smtpFromName: toNullable(raw.smtpFromName),
    smtpFromEmail: toNullable(raw.smtpFromEmail),
    copyrightText: toNullable(raw.copyrightText),
    footerTagline: toNullable(raw.footerTagline),
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

  revalidatePath("/admin/settings");
  revalidatePath("/");
}
