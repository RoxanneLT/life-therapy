import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateTempPassword } from "@/lib/auth/temp-password";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";
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

/**
 * Generate a password reset URL for a student.
 * If no Supabase auth account exists, creates one with a temp password.
 */
async function generatePasswordResetUrl(
  student: { id: string; email: string; supabaseUserId: string | null }
): Promise<string | null> {
  try {
    if (!student.supabaseUserId) {
      const tempPassword = generateTempPassword();
      const { data: authUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email: student.email,
          password: tempPassword,
          email_confirm: true,
        });

      if (createError || !authUser?.user) {
        console.error(`[drip] Failed to create auth user for ${student.email}:`, createError?.message);
        return null;
      }

      await prisma.student.update({
        where: { id: student.id },
        data: {
          supabaseUserId: authUser.user.id,
          mustChangePassword: true,
        },
      });
    }

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: student.email,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.error(`[drip] Failed to generate reset link for ${student.email}:`, linkError?.message);
      return null;
    }

    return `${DEFAULT_BASE_URL}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`;
  } catch (err) {
    console.error(`[drip] Password reset URL error for ${student.email}:`, err);
    return null;
  }
}

interface DripCandidate {
  studentId: string;
  email: string;
  firstName: string;
  supabaseUserId: string | null;
  unsubscribeToken: string | null;
  daysSinceSignup: number;
  currentPhase: "onboarding" | "newsletter";
  currentStep: number;
  progressId: string | null;
  isPaused: boolean;
  completedAt: Date | null;
  clientStatus: string;
  hasConsultationBooking: boolean;
}

interface DripResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * Process drip emails for all eligible clients.
 * Called daily by the cron job.
 */
export async function processDripEmails(): Promise<DripResult> {
  const result: DripResult = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  // Get dynamic phase counts from DB
  const phaseCounts = await getDripPhaseCounts();

  // Get all eligible clients with their drip progress
  const students = await prisma.student.findMany({
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

  // Pre-fetch free consultation bookings for all students in one query
  // (pending, confirmed, or completed — anything that means they've engaged)
  const consultationBookings = await prisma.booking.findMany({
    where: {
      clientEmail: { in: students.map((s) => s.email) },
      sessionType: "free_consultation",
      status: { in: ["pending", "confirmed", "completed"] },
    },
    select: { clientEmail: true },
  });
  const emailsWithConsultation = new Set(
    consultationBookings.map((b) => b.clientEmail.toLowerCase())
  );

  // Build candidates list
  const candidates: DripCandidate[] = [];
  const now = new Date();

  for (const student of students) {
    const daysSinceSignup = Math.floor(
      (now.getTime() - student.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    const progress = student.dripProgress;

    // Skip completed clients
    if (progress?.completedAt) continue;
    // Skip paused clients
    if (progress?.isPaused) continue;

    candidates.push({
      studentId: student.id,
      email: student.email,
      firstName: student.firstName,
      supabaseUserId: student.supabaseUserId,
      unsubscribeToken: student.unsubscribeToken,
      daysSinceSignup,
      currentPhase: (progress?.currentPhase as "onboarding" | "newsletter") || "onboarding",
      currentStep: progress?.currentStep ?? 0,
      progressId: progress?.id || null,
      isPaused: progress?.isPaused ?? false,
      completedAt: progress?.completedAt ?? null,
      clientStatus: student.clientStatus,
      hasConsultationBooking: emailsWithConsultation.has(student.email.toLowerCase()),
    });
  }

  // Process in batches
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = candidates.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((candidate) => processSingleClient(candidate, phaseCounts))
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

/**
 * Drip emails whose primary CTA is "book a free consultation".
 * If the client already has a consultation booked/done, these are
 * skipped entirely (not just CTA-stripped) because the whole email
 * is oriented around that action.
 */
const FREE_CONSULTATION_CTA_STEPS: Record<string, number[]> = {
  onboarding: [11],       // onboarding_11: "What's Next? Book a Free Consultation"
  newsletter: [5, 11, 31, 38], // newsletter_5, 11, 31, 38 all have "Book Free Consultation" as CTA
};

/**
 * Drip emails that mention free consultation in the body (inline link)
 * but have a DIFFERENT primary CTA. For these, we strip the inline link
 * rather than skipping the whole email.
 */
const FREE_CONSULTATION_INLINE_STEPS: Record<string, number[]> = {
  onboarding: [7],       // onboarding_7: "Ready to Go Deeper" — primary CTA is /courses
  newsletter: [3],        // newsletter_3: "A Letter to You" — no CTA, inline link to /book
};

async function processSingleClient(
  candidate: DripCandidate,
  phaseCounts: { onboarding: number; newsletter: number }
): Promise<"sent" | "skipped" | "failed"> {
  const { currentPhase, currentStep, daysSinceSignup } = candidate;

  // ── INTELLIGENCE: Auto-graduate converted clients ──
  // If client was converted to "active" and is still in onboarding,
  // skip the rest of onboarding and jump to newsletter.
  if (
    currentPhase === "onboarding" &&
    (candidate.clientStatus === "active" || candidate.clientStatus === "inactive")
  ) {
    console.log(
      `[drip] Client ${candidate.email} is '${candidate.clientStatus}' — graduating from onboarding to newsletter`
    );
    await graduateToNewsletter(candidate);
    return "skipped";
  }

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

  // ── INTELLIGENCE: Skip "book free consultation" emails ──
  // If client already has a free consultation (booked, confirmed, or done),
  // skip emails whose entire purpose is prompting that booking.
  if (candidate.hasConsultationBooking) {
    const ctaSteps = FREE_CONSULTATION_CTA_STEPS[currentPhase] || [];
    if (ctaSteps.includes(currentStep)) {
      console.log(
        `[drip] Skipping ${currentPhase}_${currentStep} for ${candidate.email} — already has free consultation`
      );
      await advanceProgress(candidate, phaseCounts);
      return "skipped";
    }
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

  // Auto-pause cold clients: check last 5 tracked emails
  const isCold = await checkClientEngagement(candidate.studentId);
  if (isCold) {
    await prisma.student.update({
      where: { id: candidate.studentId },
      data: {
        emailPaused: true,
        emailPausedAt: new Date(),
        emailPauseReason: "5_consecutive_unopened",
      },
    });
    return "skipped";
  }

  // Build and send the email
  const unsubscribeUrl = candidate.unsubscribeToken
    ? `${DEFAULT_BASE_URL}/api/unsubscribe?token=${candidate.unsubscribeToken}`
    : undefined;
  const variables: Record<string, string> = {
    firstName: candidate.firstName || "there",
    unsubscribeUrl: unsubscribeUrl || "",
  };

  // Generate password reset URL only if the email template uses it
  const needsPasswordReset =
    dripEmail.bodyHtml.includes("{{passwordResetUrl}}") ||
    (dripEmail.ctaUrl && dripEmail.ctaUrl === "{{passwordResetUrl}}");
  if (needsPasswordReset) {
    const resetUrl = await generatePasswordResetUrl({
      id: candidate.studentId,
      email: candidate.email,
      supabaseUserId: candidate.supabaseUserId,
    });
    variables.passwordResetUrl = resetUrl || `${DEFAULT_BASE_URL}/forgot-password`;
  }

  let bodyHtml = replacePlaceholders(dripEmail.bodyHtml, variables);

  // ── INTELLIGENCE: Strip inline free consultation links ──
  // For emails that mention free consultation in passing but have
  // a different primary CTA, replace the inline link with a softer mention.
  if (candidate.hasConsultationBooking) {
    const inlineSteps = FREE_CONSULTATION_INLINE_STEPS[currentPhase] || [];
    if (inlineSteps.includes(currentStep)) {
      // Replace inline <a> tags pointing to free_consultation with plain text
      bodyHtml = bodyHtml.replace(
        /<a\s+href="[^"]*free_consultation[^"]*"[^>]*>([^<]+)<\/a>/gi,
        "reach out to me directly"
      );
    }
  }

  // Add CTA button if defined
  if (dripEmail.ctaText && dripEmail.ctaUrl) {
    let ctaUrl = replacePlaceholders(dripEmail.ctaUrl, variables);
    if (ctaUrl.startsWith("/")) {
      ctaUrl = `${DEFAULT_BASE_URL}${ctaUrl}`;
    }
    bodyHtml += `<div style="text-align: center; margin: 28px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${dripEmail.ctaText}</a></div>`;
  }

  const subject = replacePlaceholders(dripEmail.subject, variables);
  const html = baseTemplate(subject, bodyHtml, DEFAULT_BASE_URL, unsubscribeUrl);

  const emailResult = await sendEmail({
    to: candidate.email,
    subject,
    html,
    templateKey,
    metadata: {
      studentId: candidate.studentId,
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
 * Check if a client is "cold" — 5 consecutive tracked emails with no opens.
 * Returns true if the client should be auto-paused.
 */
async function checkClientEngagement(studentId: string): Promise<boolean> {
  const recentEmails = await prisma.emailLog.findMany({
    where: {
      studentId,
      status: "sent",
      trackingId: { not: null },
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

/**
 * Graduate a client from onboarding directly to newsletter phase.
 * Called when a potential client converts to active during onboarding.
 */
async function graduateToNewsletter(
  candidate: DripCandidate
): Promise<void> {
  if (candidate.progressId) {
    await prisma.dripProgress.update({
      where: { id: candidate.progressId },
      data: {
        currentPhase: "newsletter",
        currentStep: 0,
        lastSentAt: new Date(),
      },
    });
  } else {
    await prisma.dripProgress.create({
      data: {
        studentId: candidate.studentId,
        currentPhase: "newsletter",
        currentStep: 0,
        lastSentAt: new Date(),
      },
    });
  }
}

async function advanceProgress(
  candidate: DripCandidate,
  phaseCounts: { onboarding: number; newsletter: number }
): Promise<void> {
  const { currentPhase, currentStep, studentId, progressId } = candidate;

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
        studentId,
        currentPhase: nextPhase,
        currentStep: nextStep,
        lastSentAt: new Date(),
        completedAt,
      },
    });
  }
}
