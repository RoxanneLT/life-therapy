"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendCampaign } from "@/lib/campaign-send";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";
import { getCampaignRecipients } from "@/lib/contacts";

export async function saveCampaignAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string)?.trim();
  const subject = (formData.get("subject") as string)?.trim();
  const bodyHtml = (formData.get("bodyHtml") as string)?.trim();
  const filterSource = (formData.get("filterSource") as string) || undefined;
  const filterTagsStr = (formData.get("filterTags") as string)?.trim();
  const filterTags = filterTagsStr
    ? filterTagsStr.split(",").map((t) => t.trim()).filter(Boolean)
    : undefined;

  if (!name || !subject || !bodyHtml) {
    throw new Error("Name, subject, and body are required");
  }

  if (id) {
    // Update existing draft
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.status !== "draft") {
      throw new Error("Can only edit draft campaigns");
    }

    await prisma.campaign.update({
      where: { id },
      data: { name, subject, bodyHtml, filterSource, filterTags },
    });

    revalidatePath("/admin/campaigns");
    revalidatePath(`/admin/campaigns/${id}`);
    redirect(`/admin/campaigns/${id}`);
  } else {
    // Create new draft
    const campaign = await prisma.campaign.create({
      data: { name, subject, bodyHtml, filterSource, filterTags, status: "draft" },
    });

    revalidatePath("/admin/campaigns");
    redirect(`/admin/campaigns/${campaign.id}`);
  }
}

export async function sendCampaignAction(campaignId: string) {
  const { adminUser } = await requireRole("super_admin", "marketing");

  // Set the sender ID
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { sentById: adminUser.id },
  });

  const result = await sendCampaign(campaignId);

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);

  return result;
}

export async function sendTestCampaignAction(campaignId: string) {
  const { adminUser } = await requireRole("super_admin", "marketing");

  if (!adminUser.email) {
    throw new Error("Could not determine admin email address");
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error("Campaign not found");

  // Replace variables with sample data
  const testBody = campaign.bodyHtml
    .replace(/\{\{firstName\}\}/g, "Test User")
    .replace(/\{\{unsubscribeUrl\}\}/g, "#");

  const html = baseTemplate(campaign.name, testBody);

  const result = await sendEmail({
    to: adminUser.email,
    subject: `[TEST] ${campaign.subject.replace(/\{\{firstName\}\}/g, "Test User")}`,
    html,
    templateKey: "campaign_test",
  });

  return { success: result.success, sentTo: adminUser.email };
}

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

export async function getRecipientCountAction(filters?: {
  source?: string;
  tags?: string[];
}) {
  await requireRole("super_admin", "marketing");

  const recipients = await getCampaignRecipients(filters);
  return recipients.length;
}
