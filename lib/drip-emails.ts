import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

/** Get the total number of emails in each drip phase from DB */
export async function getDripPhaseCounts(): Promise<{ onboarding: number; newsletter: number }> {
  const [onboarding, newsletter] = await Promise.all([
    prisma.dripEmail.count({ where: { type: "onboarding" } }),
    prisma.dripEmail.count({ where: { type: "newsletter" } }),
  ]);
  return { onboarding, newsletter };
}

function replacePlaceholders(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in variables ? variables[key] : match;
  });
}

interface DripCandidate {
  contactId: string;
  email: string;
  firstName: string | null;
  unsubscribeToken: string;
  daysSinceSignup: number;
  currentPhase: "onboarding" | "newsletter";
  currentStep: number;
  progressId: string | null;
  isPaused: boolean;
  completedAt: Date | null;
}

interface DripResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Process drip emails for all eligible contacts.
 * Called daily by the cron job.
 */
export async function processDripEmails(): Promise<DripResult> {
  const result: DripResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  // Get dynamic phase counts from DB
  const phaseCounts = await getDripPhaseCounts();

  // Get all eligible contacts with their drip progress
  const contacts = await prisma.contact.findMany({
    where: {
      consentGiven: true,
      emailOptOut: false,
      emailPaused: false,
    },
    include: {
      dripProgress: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Build candidates list
  const candidates: DripCandidate[] = [];
  const now = new Date();

  for (const contact of contacts) {
    const daysSinceSignup = Math.floor(
      (now.getTime() - contact.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const progress = contact.dripProgress;

    // Skip completed contacts
    if (progress?.completedAt) continue;
    // Skip paused contacts
    if (progress?.isPaused) continue;

    candidates.push({
      contactId: contact.id,
      email: contact.email,
      firstName: contact.firstName,
      unsubscribeToken: contact.unsubscribeToken,
      daysSinceSignup,
      currentPhase: (progress?.currentPhase as "onboarding" | "newsletter") || "onboarding",
      currentStep: progress?.currentStep ?? 0,
      progressId: progress?.id || null,
      isPaused: progress?.isPaused ?? false,
      completedAt: progress?.completedAt ?? null,
    });
  }

  // Process in batches
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((candidate) => processSingleContact(candidate, phaseCounts))
    );

    for (const res of results) {
      result.processed++;
      if (res.status === "fulfilled") {
        if (res.value === "sent") result.sent++;
        else if (res.value === "skipped") result.skipped++;
        else if (res.value === "failed") result.failed++;
      } else {
        result.failed++;
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < candidates.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  return result;
}

async function processSingleContact(
  candidate: DripCandidate,
  phaseCounts: { onboarding: number; newsletter: number }
): Promise<"sent" | "skipped" | "failed"> {
  const { currentPhase, currentStep, daysSinceSignup } = candidate;

  // Look up the drip email for this step
  const dripEmail = await prisma.dripEmail.findUnique({
    where: { type_step: { type: currentPhase, step: currentStep } },
  });

  if (!dripEmail || !dripEmail.isActive) {
    return "skipped";
  }

  // Check if it's time to send (daysSinceSignup >= dayOffset)
  if (daysSinceSignup < dripEmail.dayOffset) {
    return "skipped";
  }

  // Idempotency: check if already sent via EmailLog
  const templateKey = `drip_${currentPhase}_${currentStep}`;
  const alreadySent = await prisma.emailLog.findFirst({
    where: {
      templateKey,
      to: candidate.email,
    },
  });

  if (alreadySent) {
    // Already sent — advance progress without resending
    await advanceProgress(candidate, phaseCounts);
    return "skipped";
  }

  // Auto-pause cold contacts: check last 5 tracked emails
  const isCold = await checkContactEngagement(candidate.contactId);
  if (isCold) {
    await prisma.contact.update({
      where: { id: candidate.contactId },
      data: {
        emailPaused: true,
        emailPausedAt: new Date(),
        emailPauseReason: "5_consecutive_unopened",
      },
    });
    return "skipped";
  }

  // Build and send the email
  const unsubscribeUrl = `${DEFAULT_BASE_URL}/api/unsubscribe?token=${candidate.unsubscribeToken}`;
  const variables: Record<string, string> = {
    firstName: candidate.firstName || "there",
    unsubscribeUrl,
  };

  let bodyHtml = replacePlaceholders(dripEmail.bodyHtml, variables);

  // Add CTA button if defined
  if (dripEmail.ctaText && dripEmail.ctaUrl) {
    const ctaUrl = dripEmail.ctaUrl.startsWith("/")
      ? `${DEFAULT_BASE_URL}${dripEmail.ctaUrl}`
      : dripEmail.ctaUrl;
    bodyHtml += `<div style="text-align: center; margin: 28px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #1E4B6E; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${dripEmail.ctaText}</a></div>`;
  }

  const subject = replacePlaceholders(dripEmail.subject, variables);
  const html = baseTemplate(subject, bodyHtml, DEFAULT_BASE_URL, unsubscribeUrl);

  const emailResult = await sendEmail({
    to: candidate.email,
    subject,
    html,
    templateKey,
    metadata: {
      contactId: candidate.contactId,
      dripEmailId: dripEmail.id,
      dripPhase: currentPhase,
      dripStep: currentStep,
    },
  });

  if (!emailResult.success) {
    return "failed";
  }

  // Advance progress
  await advanceProgress(candidate, phaseCounts);
  return "sent";
}

/**
 * Check if a contact is "cold" — 5 consecutive tracked emails with no opens.
 * Returns true if the contact should be auto-paused.
 */
async function checkContactEngagement(contactId: string): Promise<boolean> {
  const recentEmails = await prisma.emailLog.findMany({
    where: {
      status: "sent",
      trackingId: { not: null },
      metadata: { path: ["contactId"], equals: contactId },
    },
    orderBy: { sentAt: "desc" },
    take: 5,
    select: { openedAt: true },
  });

  // Only check if we have 5+ tracked emails
  if (recentEmails.length < 5) return false;

  // If all 5 are unopened → cold
  return recentEmails.every((e) => !e.openedAt);
}

async function advanceProgress(
  candidate: DripCandidate,
  phaseCounts: { onboarding: number; newsletter: number }
): Promise<void> {
  const { currentPhase, currentStep, contactId, progressId } = candidate;

  let nextPhase: "onboarding" | "newsletter" = currentPhase;
  let nextStep = currentStep + 1;
  let completedAt: Date | null = null;

  // Phase transition logic (using dynamic counts from DB)
  if (currentPhase === "onboarding" && nextStep >= phaseCounts.onboarding) {
    // Move to newsletter phase
    nextPhase = "newsletter";
    nextStep = 0;
  } else if (currentPhase === "newsletter" && nextStep >= phaseCounts.newsletter) {
    // Completed all emails
    completedAt = new Date();
  }

  if (progressId) {
    // Update existing progress
    await prisma.dripProgress.update({
      where: { id: progressId },
      data: {
        currentPhase: nextPhase,
        currentStep: nextStep,
        lastSentAt: new Date(),
        completedAt,
      },
    });
  } else {
    // Create new progress record (first email sent)
    await prisma.dripProgress.create({
      data: {
        contactId,
        currentPhase: nextPhase,
        currentStep: nextStep,
        lastSentAt: new Date(),
        completedAt,
      },
    });
  }
}
