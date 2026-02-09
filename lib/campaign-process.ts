import { prisma } from "@/lib/prisma";
import { getCampaignRecipients } from "@/lib/contacts";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;
const COLD_THRESHOLD = 5; // Auto-pause after 5 consecutive unopened emails

function replacePlaceholders(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

interface CampaignProcessResult {
  activated: number;
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  completed: number;
  autoPaused: number;
}

/**
 * Process multi-step campaigns: activate scheduled ones + send due emails.
 * Called daily by cron.
 */
export async function processCampaigns(): Promise<CampaignProcessResult> {
  const result: CampaignProcessResult = {
    activated: 0,
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    completed: 0,
    autoPaused: 0,
  };

  await activateScheduledCampaigns(result);
  await processActiveCampaigns(result);

  return result;
}

/**
 * Phase 1: Activate campaigns whose startDate has arrived.
 */
async function activateScheduledCampaigns(result: CampaignProcessResult) {
  const now = new Date();

  const scheduledCampaigns = await prisma.campaign.findMany({
    where: {
      status: "scheduled",
      isMultiStep: true,
      startDate: { lte: now },
    },
  });

  for (const campaign of scheduledCampaigns) {
    const recipients = await getCampaignRecipients({
      source: campaign.filterSource || undefined,
      tags: (campaign.filterTags as string[]) || undefined,
    });

    if (recipients.length > 0) {
      // Create progress records for each contact
      await prisma.campaignProgress.createMany({
        data: recipients.map((r) => ({
          campaignId: campaign.id,
          contactId: r.id,
          currentStep: 0,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "active",
        activatedAt: now,
        totalRecipients: recipients.length,
      },
    });

    result.activated++;
  }
}

/**
 * Phase 2: Process active campaigns — send due emails, advance progress.
 */
async function processActiveCampaigns(result: CampaignProcessResult) {
  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "active", isMultiStep: true },
    include: {
      emails: { where: { isActive: true }, orderBy: { step: "asc" } },
    },
  });

  for (const campaign of activeCampaigns) {
    if (campaign.emails.length === 0) continue;

    const totalSteps = campaign.emails.length;
    const daysSinceActivation = campaign.activatedAt
      ? Math.floor((Date.now() - campaign.activatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Get non-completed progress records with contact data
    const progressRecords = await prisma.campaignProgress.findMany({
      where: {
        campaignId: campaign.id,
        completedAt: null,
        isPaused: false,
      },
      include: {
        contact: {
          select: {
            id: true,
            email: true,
            firstName: true,
            unsubscribeToken: true,
            consentGiven: true,
            emailOptOut: true,
            emailPaused: true,
          },
        },
      },
    });

    // Build candidate list for this campaign
    const candidates = progressRecords.filter(
      (p) => p.contact.consentGiven && !p.contact.emailOptOut && !p.contact.emailPaused
    );

    // Process in batches
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map((progress) =>
          processSingleCampaignContact(campaign, progress, totalSteps, daysSinceActivation)
        )
      );

      for (const res of results) {
        result.processed++;
        if (res.status === "fulfilled") {
          if (res.value === "sent") result.sent++;
          else if (res.value === "skipped") result.skipped++;
          else if (res.value === "failed") result.failed++;
          else if (res.value === "auto_paused") result.autoPaused++;
        } else {
          result.failed++;
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < candidates.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // Update campaign aggregate counts
    const [sentCount, failedCount, completedCount] = await Promise.all([
      prisma.emailLog.count({
        where: { templateKey: { startsWith: `campaign_${campaign.id}_` }, status: "sent" },
      }),
      prisma.emailLog.count({
        where: { templateKey: { startsWith: `campaign_${campaign.id}_` }, status: "failed" },
      }),
      prisma.campaignProgress.count({
        where: { campaignId: campaign.id, completedAt: { not: null } },
      }),
    ]);

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { sentCount, failedCount },
    });

    // Check if all contacts have completed
    const totalProgress = await prisma.campaignProgress.count({
      where: { campaignId: campaign.id },
    });

    if (totalProgress > 0 && completedCount >= totalProgress) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "completed", completedAt: new Date() },
      });
      result.completed++;
    }
  }
}

type CampaignWithEmails = Awaited<ReturnType<typeof prisma.campaign.findMany>>[number] & {
  emails: Awaited<ReturnType<typeof prisma.campaignEmail.findMany>>;
};

type ProgressWithContact = Awaited<ReturnType<typeof prisma.campaignProgress.findMany>>[number] & {
  contact: {
    id: string;
    email: string;
    firstName: string | null;
    unsubscribeToken: string;
    consentGiven: boolean;
    emailOptOut: boolean;
    emailPaused: boolean;
  };
};

async function processSingleCampaignContact(
  campaign: CampaignWithEmails,
  progress: ProgressWithContact,
  totalSteps: number,
  daysSinceActivation: number,
): Promise<"sent" | "skipped" | "failed" | "auto_paused"> {
  const { contact } = progress;

  // Check engagement: auto-pause if last N emails all unopened
  const isCold = await checkContactEngagement(contact.email);
  if (isCold) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        emailPaused: true,
        emailPausedAt: new Date(),
        emailPauseReason: `${COLD_THRESHOLD}_consecutive_unopened`,
      },
    });
    return "auto_paused";
  }

  // Find the email for the current step
  const campaignEmail = campaign.emails.find((e) => e.step === progress.currentStep);
  if (!campaignEmail) {
    return "skipped";
  }

  // Check if day offset has been reached
  if (daysSinceActivation < campaignEmail.dayOffset) {
    return "skipped";
  }

  // Idempotency: check EmailLog
  const templateKey = `campaign_${campaign.id}_${progress.currentStep}`;
  const alreadySent = await prisma.emailLog.findFirst({
    where: { templateKey, to: contact.email },
  });

  if (alreadySent) {
    // Already sent — advance progress without resending
    await advanceCampaignProgress(progress, totalSteps);
    return "skipped";
  }

  // Build and send
  const unsubscribeUrl = `${DEFAULT_BASE_URL}/api/unsubscribe?token=${contact.unsubscribeToken}`;
  const variables: Record<string, string> = {
    firstName: contact.firstName || "there",
    unsubscribeUrl,
  };

  let bodyHtml = replacePlaceholders(campaignEmail.bodyHtml, variables);

  // Add CTA button if defined
  if (campaignEmail.ctaText && campaignEmail.ctaUrl) {
    const ctaUrl = campaignEmail.ctaUrl.startsWith("/")
      ? `${DEFAULT_BASE_URL}${campaignEmail.ctaUrl}`
      : campaignEmail.ctaUrl;
    bodyHtml += `<div style="text-align: center; margin: 28px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #1E4B6E; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${campaignEmail.ctaText}</a></div>`;
  }

  const subject = replacePlaceholders(campaignEmail.subject, variables);
  const html = baseTemplate(subject, bodyHtml, DEFAULT_BASE_URL, unsubscribeUrl);

  const emailResult = await sendEmail({
    to: contact.email,
    subject,
    html,
    templateKey,
    metadata: {
      campaignId: campaign.id,
      campaignEmailId: campaignEmail.id,
      contactId: contact.id,
      step: progress.currentStep,
    },
  });

  if (!emailResult.success) {
    return "failed";
  }

  await advanceCampaignProgress(progress, totalSteps);
  return "sent";
}

async function advanceCampaignProgress(
  progress: ProgressWithContact,
  totalSteps: number,
) {
  const nextStep = progress.currentStep + 1;
  const isComplete = nextStep >= totalSteps;

  await prisma.campaignProgress.update({
    where: { id: progress.id },
    data: {
      currentStep: nextStep,
      lastSentAt: new Date(),
      completedAt: isComplete ? new Date() : null,
    },
  });
}

/**
 * Check if a contact is "cold" — last N sent emails all unopened.
 * Returns true if the contact should be auto-paused.
 */
async function checkContactEngagement(email: string): Promise<boolean> {
  const recentEmails = await prisma.emailLog.findMany({
    where: {
      to: email,
      status: "sent",
      trackingId: { not: null }, // Only check tracked emails
    },
    orderBy: { sentAt: "desc" },
    take: COLD_THRESHOLD,
    select: { openedAt: true },
  });

  // Need at least COLD_THRESHOLD tracked emails to make a decision
  if (recentEmails.length < COLD_THRESHOLD) {
    return false;
  }

  // Cold if ALL recent emails are unopened
  return recentEmails.every((e) => e.openedAt === null);
}
