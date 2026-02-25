import { prisma } from "@/lib/prisma";
import { getCampaignRecipients } from "@/lib/contacts";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

function replacePlaceholders(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

/**
 * Send a campaign to all matching recipients.
 * Sends in batches of 10 with 1s delay between batches.
 */
export async function sendCampaign(campaignId: string): Promise<{
  sentCount: number;
  failedCount: number;
  totalRecipients: number;
}> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (campaign.isMultiStep) {
    throw new Error("Multi-step campaigns must be scheduled, not sent directly. Use the Schedule action.");
  }

  if (campaign.status !== "draft") {
    throw new Error(`Campaign is already ${campaign.status}`);
  }

  if (!campaign.subject || !campaign.bodyHtml) {
    throw new Error("Single-email campaigns require a subject and body");
  }

  // Narrowed after null check above
  const campaignSubject = campaign.subject;
  const campaignBody = campaign.bodyHtml;

  // Set status to sending
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "sending" },
  });

  try {
    // Get eligible recipients
    const recipients = await getCampaignRecipients({
      source: campaign.filterSource || undefined,
      tags: (campaign.filterTags as string[]) || undefined,
    });

    // Update total recipients
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: recipients.length },
    });

    let sentCount = 0;
    let failedCount = 0;

    // Process in batches
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
          const unsubscribeUrl = `${DEFAULT_BASE_URL}/api/unsubscribe?token=${recipient.unsubscribeToken}`;

          const variables: Record<string, string> = {
            firstName: recipient.firstName || "there",
            unsubscribeUrl,
          };

          const bodyHtml = replacePlaceholders(campaignBody, variables);
          const subject = replacePlaceholders(campaignSubject, variables);
          const html = baseTemplate(campaign.name, bodyHtml, DEFAULT_BASE_URL, unsubscribeUrl);

          return sendEmail({
            to: recipient.email,
            subject,
            html,
            templateKey: "campaign_broadcast",
            metadata: { campaignId, studentId: recipient.id },
          });
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && result.value.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      // Update counts after each batch
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { sentCount, failedCount },
      });

      // Delay between batches (skip delay after the last batch)
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Final status
    const finalStatus = recipients.length === 0 || sentCount > 0 ? "sent" : "failed";
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        sentAt: new Date(),
        sentCount,
        failedCount,
      },
    });

    return { sentCount, failedCount, totalRecipients: recipients.length };
  } catch (error) {
    // Mark campaign as failed on unexpected error
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "failed" },
    });
    throw error;
  }
}
