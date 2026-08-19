import { prisma } from "@/lib/prisma";
import { escapeTemplateVariables, replacePlaceholders } from "@/lib/email-render";
import { getCampaignRecipients } from "@/lib/contacts";
import { sendEmail } from "@/lib/email";
import { baseTemplate, normalizeEmailHtml } from "@/lib/email-templates";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateTempPassword } from "@/lib/auth/temp-password";
import { appBaseUrl } from "@/lib/region";

const DEFAULT_BASE_URL = appBaseUrl();
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 1200;


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

  // "sending" and "failed" are RESUMABLE, not terminal.
  //
  // At ~1.7s per recipient (BATCH_SIZE 2, BATCH_DELAY_MS 1200) a hundred-recipient
  // list comfortably outlives any function timeout. When the run was killed, nothing
  // ran the catch below, so the campaign sat in "sending" forever — and because this
  // guard only admitted "draft", it could not be restarted at all. The only recovery
  // was to force the status back to draft, which re-emailed everyone already reached.
  //
  // Resuming is safe now because the send loop skips recipients that already have a
  // successful log row for THIS campaign. "sent" stays terminal: that campaign is
  // finished, and re-running it would mail anyone who has since joined the audience.
  if (!["draft", "sending", "failed"].includes(campaign.status)) {
    throw new Error(`Campaign is already ${campaign.status}`);
  }

  if (!campaign.subject || !campaign.bodyHtml) {
    throw new Error("Single-email campaigns require a subject and body");
  }

  // Narrowed after null check above
  const campaignSubject = campaign.subject;
  const campaignBody = campaign.bodyHtml;

  /** Per-campaign checkpoint key in email_logs — the ledger the resume reads. */
  const campaignTemplateKey = `campaign_broadcast_${campaignId}`;

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

    // Who has this campaign ALREADY reached?
    //
    // One indexed query, not one per recipient — the whole point is that this runs
    // for lists long enough to be interrupted, so the resume must not itself cost N
    // round trips. templateKey is campaign-specific (see the send below), so this
    // set is exactly "already received THIS campaign", and status "sent" excludes
    // failures, which must be retried rather than skipped.
    const alreadySent = new Set(
      (
        await prisma.emailLog.findMany({
          where: { templateKey: campaignTemplateKey, status: "sent" },
          select: { to: true },
        })
      ).map((r) => r.to),
    );

    // A resume must not reset the tally to zero — those people really were emailed.
    let sentCount = alreadySent.size;
    let failedCount = 0;

    const pending = recipients.filter((r) => !alreadySent.has(r.email));
    if (alreadySent.size > 0) {
      console.warn(
        `[campaign ${campaignId}] resuming: ${alreadySent.size} already sent, ${pending.length} to go`,
      );
    }

    // Process in batches
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (recipient) => {
          const unsubscribeUrl = `${DEFAULT_BASE_URL}/api/unsubscribe?token=${recipient.unsubscribeToken}`;

          const variables: Record<string, string> = {
            firstName: recipient.firstName || "there",
            unsubscribeUrl,
          };
          // Escaped before substitution. These placeholders carry client-supplied values —
          // firstName reaches the database from the PUBLIC booking form and the
          // unauthenticated newsletter signup — and this file has its OWN copy of
          // replacePlaceholders, so the escaping added at renderEmail never covered it.
          // Five copies of that function exist across lib/; #18 fixed exactly one.
          const safeVariables = escapeTemplateVariables(variables);

          if (needsPasswordReset) {
            const resetUrl = await generatePasswordResetUrl(recipient);
            variables.passwordResetUrl = resetUrl || `${DEFAULT_BASE_URL}/forgot-password`;
          }

          const bodyHtml = normalizeEmailHtml(replacePlaceholders(campaignBody, safeVariables));
          const subject = replacePlaceholders(campaignSubject, safeVariables);
          const html = baseTemplate("", bodyHtml, DEFAULT_BASE_URL, unsubscribeUrl);

          return sendEmail({
            to: recipient.email,
            subject,
            html,
            // Campaign-SPECIFIC key. The shared "campaign_broadcast" could not tell
            // which campaign a recipient had received, so it was useless as a
            // checkpoint; this makes email_logs a per-campaign ledger, which is what
            // the resume above reads. (templateKey is indexed.)
            templateKey: campaignTemplateKey,
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
      if (i + BATCH_SIZE < pending.length) {
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
