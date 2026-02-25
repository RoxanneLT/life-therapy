"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendCampaign } from "@/lib/campaign-send";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";
import { getCampaignRecipients } from "@/lib/contacts";

// ────────────────────────────────────────────────────────────
// Save (create or update) a campaign
// ────────────────────────────────────────────────────────────

type CampaignFilters = { name: string; filterSource?: string; filterTags?: string[] };

function parseCampaignEmailsJson(formData: FormData) {
  const emailsJson = formData.get("emails") as string;
  const emails: Array<{
    step: number; dayOffset: number; subject: string; previewText?: string;
    bodyHtml: string; ctaText?: string; ctaUrl?: string;
  }> = emailsJson ? JSON.parse(emailsJson) : [];
  if (emails.length === 0) throw new Error("Multi-step campaigns must have at least one email step");
  return emails;
}

function mapEmailSteps(emails: ReturnType<typeof parseCampaignEmailsJson>) {
  return emails.map((e, i) => ({
    step: i,
    dayOffset: e.dayOffset,
    subject: e.subject.trim(),
    previewText: e.previewText?.trim() || null,
    bodyHtml: e.bodyHtml.trim(),
    ctaText: e.ctaText?.trim() || null,
    ctaUrl: e.ctaUrl?.trim() || null,
  }));
}

async function saveMultiStepCampaign(id: string | null, filters: CampaignFilters, formData: FormData) {
  const emails = parseCampaignEmailsJson(formData);

  if (id) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (campaign?.status !== "draft") throw new Error("Can only edit draft campaigns");

    await prisma.campaign.update({ where: { id }, data: { ...filters, isMultiStep: true } });
    await prisma.campaignEmail.deleteMany({ where: { campaignId: id } });
    await prisma.campaignEmail.createMany({ data: mapEmailSteps(emails).map((e) => ({ ...e, campaignId: id })) });

    revalidatePath("/admin/campaigns");
    revalidatePath(`/admin/campaigns/${id}`);
    redirect(`/admin/campaigns/${id}`);
  }

  const campaign = await prisma.campaign.create({
    data: { ...filters, isMultiStep: true, status: "draft", emails: { create: mapEmailSteps(emails) } },
  });
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${campaign.id}`);
}

async function saveSingleEmailCampaign(id: string | null, filters: CampaignFilters, formData: FormData) {
  const subject = (formData.get("subject") as string)?.trim();
  const bodyHtml = (formData.get("bodyHtml") as string)?.trim();
  if (!subject || !bodyHtml) throw new Error("Subject and body are required for single-email campaigns");

  if (id) {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (campaign?.status !== "draft") throw new Error("Can only edit draft campaigns");

    await prisma.campaign.update({ where: { id }, data: { ...filters, subject, bodyHtml, isMultiStep: false } });
    revalidatePath("/admin/campaigns");
    revalidatePath(`/admin/campaigns/${id}`);
    redirect(`/admin/campaigns/${id}`);
  }

  const campaign = await prisma.campaign.create({
    data: { ...filters, subject, bodyHtml, isMultiStep: false, status: "draft" },
  });
  revalidatePath("/admin/campaigns");
  redirect(`/admin/campaigns/${campaign.id}`);
}

export async function saveCampaignAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string)?.trim();
  if (!name) throw new Error("Campaign name is required");

  const filterSource = (formData.get("filterSource") as string) || undefined;
  const filterTagsStr = (formData.get("filterTags") as string)?.trim();
  const filterTags = filterTagsStr ? filterTagsStr.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  const filters: CampaignFilters = { name, filterSource, filterTags };

  if (formData.get("isMultiStep") === "true") {
    await saveMultiStepCampaign(id, filters, formData);
  } else {
    await saveSingleEmailCampaign(id, filters, formData);
  }
}

// ────────────────────────────────────────────────────────────
// Single-email: send immediately
// ────────────────────────────────────────────────────────────

export async function sendCampaignAction(campaignId: string) {
  const { adminUser } = await requireRole("super_admin", "marketing");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sentById: adminUser.id },
  });

  const result = await sendCampaign(campaignId);

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);

  return result;
}

// ────────────────────────────────────────────────────────────
// Multi-step: schedule for a future date
// ────────────────────────────────────────────────────────────

export async function scheduleCampaignAction(campaignId: string, startDate: string) {
  await requireRole("super_admin", "marketing");

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { emails: true },
  });

  if (!campaign) throw new Error("Campaign not found");
  if (!campaign.isMultiStep) throw new Error("Only multi-step campaigns can be scheduled");
  if (campaign.status !== "draft") throw new Error("Can only schedule draft campaigns");
  if (campaign.emails.length === 0) throw new Error("Campaign has no email steps");

  const parsedDate = new Date(startDate);
  if (Number.isNaN(parsedDate.getTime())) throw new Error("Invalid start date");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "scheduled", startDate: parsedDate },
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function cancelScheduleAction(campaignId: string) {
  await requireRole("super_admin", "marketing");

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "scheduled") throw new Error("Campaign is not scheduled");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "draft", startDate: null },
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

// ────────────────────────────────────────────────────────────
// Pause / Resume active campaigns
// ────────────────────────────────────────────────────────────

export async function pauseCampaignAction(campaignId: string) {
  await requireRole("super_admin", "marketing");

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "active") throw new Error("Can only pause active campaigns");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "paused" },
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

export async function resumeCampaignAction(campaignId: string) {
  await requireRole("super_admin", "marketing");

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "paused") throw new Error("Can only resume paused campaigns");

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "active" },
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
}

// ────────────────────────────────────────────────────────────
// Test emails
// ────────────────────────────────────────────────────────────

export async function sendTestCampaignAction(campaignId: string, step?: number) {
  const { adminUser } = await requireRole("super_admin", "marketing");

  if (!adminUser.email) {
    throw new Error("Could not determine admin email address");
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { emails: { orderBy: { step: "asc" } } },
  });
  if (!campaign) throw new Error("Campaign not found");

  let testSubject: string;
  let testBody: string;

  if (campaign.isMultiStep && step !== undefined) {
    // Multi-step: send a specific step
    const email = campaign.emails.find((e) => e.step === step);
    if (!email) throw new Error(`Step ${step} not found`);

    testBody = email.bodyHtml
      .replaceAll("{{firstName}}", "Test User")
      .replaceAll("{{unsubscribeUrl}}", "#");
    testSubject = `[TEST Step ${step + 1}] ${email.subject.replaceAll("{{firstName}}", "Test User")}`;
  } else if (campaign.isMultiStep) {
    // Multi-step but no step specified: send first step
    const firstEmail = campaign.emails[0];
    if (!firstEmail) throw new Error("Campaign has no email steps");

    testBody = firstEmail.bodyHtml
      .replaceAll("{{firstName}}", "Test User")
      .replaceAll("{{unsubscribeUrl}}", "#");
    testSubject = `[TEST Step 1] ${firstEmail.subject.replaceAll("{{firstName}}", "Test User")}`;
  } else {
    // Single-email campaign
    testBody = (campaign.bodyHtml || "")
      .replaceAll("{{firstName}}", "Test User")
      .replaceAll("{{unsubscribeUrl}}", "#");
    testSubject = `[TEST] ${(campaign.subject || "").replaceAll("{{firstName}}", "Test User")}`;
  }

  const html = baseTemplate(campaign.name, testBody);

  const result = await sendEmail({
    to: adminUser.email,
    subject: testSubject,
    html,
    templateKey: "campaign_test",
    skipTracking: true,
  });

  return { success: result.success, sentTo: adminUser.email };
}

// ────────────────────────────────────────────────────────────
// Delete campaign
// ────────────────────────────────────────────────────────────

export async function deleteCampaignAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Campaign ID is required");

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.status !== "draft") {
    throw new Error("Can only delete draft campaigns");
  }

  await prisma.campaign.delete({ where: { id } });

  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns");
}

// ────────────────────────────────────────────────────────────
// Audience helpers
// ────────────────────────────────────────────────────────────

export async function getRecipientCountAction(filters?: {
  source?: string;
  tags?: string[];
}) {
  await requireRole("super_admin", "marketing");

  const recipients = await getCampaignRecipients(filters);
  return recipients.length;
}
