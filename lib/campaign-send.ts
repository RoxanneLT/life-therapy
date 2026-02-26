import { prisma } from "@/lib/prisma";
import { getCampaignRecipients } from "@/lib/contacts";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateTempPassword } from "@/lib/auth/temp-password";

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
 * Generate a password reset URL for a recipient.
 * If no Supabase auth account exists, creates one with a temp password.
 */
async function generatePasswordResetUrl(
  recipient: { id: string; email: string; supabaseUserId?: string | null }
): Promise<string | null> {
  try {
    if (!recipient.supabaseUserId) {
      const tempPassword = generateTempPassword();
      const { data: authUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: recipient.email,
          password: tempPassword,
          email_confirm: true,
        });

      if (createError || !authUser?.user) {
        console.error(`[campaign] Failed to create auth user for ${recipient.email}:`, createError?.message);
        return null;
      }

      await prisma.student.update({
        where: { id: recipient.id },
        data: {
          supabaseUserId: authUser.user.id,
          mustChangePassword: true,
        },
      });
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: recipient.email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error(`[campaign] Failed to generate reset link for ${recipient.email}:`, linkError?.message);
      return null;
    }

    return `${DEFAULT_BASE_URL}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`;
  } catch (err) {
    console.error(`[campaign] Password reset URL error for ${recipient.email}:`, err);
    return null;
  }
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

  // Check if template uses passwordResetUrl
  const needsPasswordReset = campaignBody.includes("{{passwordResetUrl}}");

  // Set status to sending
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "sending" },
  });

  try {
    // Get eligible recipients
    const recipients = await getCampaignRecipients(
      {
        source: campaign.filterSource || undefined,
        tags: (campaign.filterTags as string[]) || undefined,
        clientStatus: campaign.filterClientStatus || undefined,
      },
      (campaign.audienceFilters as import("@/lib/audience-filters").AudienceFilters) || undefined
    );

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

          if (needsPasswordReset) {
            const resetUrl = await generatePasswordResetUrl(recipient);
            variables.passwordResetUrl = resetUrl || `${DEFAULT_BASE_URL}/forgot-password`;
          }

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
