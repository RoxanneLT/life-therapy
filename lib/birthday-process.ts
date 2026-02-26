import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";

/**
 * Get the gender category for template selection.
 */
function getGenderCategory(gender: string | null | undefined): "female" | "male" | "unknown" {
  if (!gender) return "unknown";
  const g = gender.toLowerCase();
  if (g === "female" || g === "woman" || g === "f") return "female";
  if (g === "male" || g === "man" || g === "m") return "male";
  return "unknown";
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
 * Send birthday emails to all eligible clients whose birthday is today.
 * Called daily by cron (runs at 08:00 SAST).
 *
 * Looks up the "birthday" type campaign in the database, selects the
 * correct email by gender + year rotation, and sends.
 *
 * Roxanne can edit all birthday templates via the campaign editor.
 */
export async function processBirthdayEmails(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
}> {
  const result = { sent: 0, skipped: 0, failed: 0 };

  // Find the active birthday campaign
  const campaign = await prisma.campaign.findFirst({
    where: { campaignType: "birthday", status: "active" },
    include: {
      emails: {
        where: { isActive: true },
        orderBy: { step: "asc" },
      },
    },
  });

  if (!campaign || campaign.emails.length === 0) {
    console.log("[birthday] No active birthday campaign found — skipping.");
    return result;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();

  // Find all students whose birthday is today
  const allStudents = await prisma.student.findMany({
    where: {
      dateOfBirth: { not: null },
      consentGiven: true,
      emailOptOut: false,
      emailPaused: false,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      gender: true,
      dateOfBirth: true,
      unsubscribeToken: true,
    },
  });

  const birthdayStudents = allStudents.filter((s) => {
    if (!s.dateOfBirth) return false;
    const dob = new Date(s.dateOfBirth);
    return dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay;
  });

  if (birthdayStudents.length === 0) return result;

  // Group emails by gender target
  const emailsByGender: Record<string, typeof campaign.emails> = {};
  for (const email of campaign.emails) {
    const target = email.genderTarget || "unknown";
    if (!emailsByGender[target]) emailsByGender[target] = [];
    emailsByGender[target].push(email);
  }

  const templateKey = `birthday_${currentYear}`;

  for (const student of birthdayStudents) {
    // Idempotency: check if already sent this year
    const alreadySent = await prisma.emailLog.findFirst({
      where: { templateKey, to: student.email },
    });

    if (alreadySent) {
      result.skipped++;
      continue;
    }

    // Select email: match gender, then rotate by year
    const category = getGenderCategory(student.gender);
    const candidates = emailsByGender[category] || emailsByGender["unknown"] || [];

    if (candidates.length === 0) {
      // Fallback: use any available email
      const fallback = campaign.emails[currentYear % campaign.emails.length];
      if (!fallback) { result.skipped++; continue; }
      candidates.push(fallback);
    }

    const templateIndex = currentYear % candidates.length;
    const selectedEmail = candidates[templateIndex];

    // Build variables
    const firstName = student.firstName || "there";
    const unsubscribeUrl = student.unsubscribeToken
      ? `${DEFAULT_BASE_URL}/api/unsubscribe?token=${student.unsubscribeToken}`
      : "";

    const variables: Record<string, string> = {
      firstName,
      unsubscribeUrl,
    };

    const subject = replacePlaceholders(selectedEmail.subject, variables);
    let bodyHtml = replacePlaceholders(selectedEmail.bodyHtml, variables);

    // Add CTA if defined
    if (selectedEmail.ctaText && selectedEmail.ctaUrl) {
      let ctaUrl = replacePlaceholders(selectedEmail.ctaUrl, variables);
      if (ctaUrl.startsWith("/")) ctaUrl = `${DEFAULT_BASE_URL}${ctaUrl}`;
      bodyHtml += `<div style="text-align: center; margin: 28px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${selectedEmail.ctaText}</a></div>`;
    }

    const html = baseTemplate(subject, bodyHtml, DEFAULT_BASE_URL, unsubscribeUrl || undefined);

    try {
      const emailResult = await sendEmail({
        to: student.email,
        subject,
        html,
        templateKey,
        metadata: {
          campaignId: campaign.id,
          campaignEmailId: selectedEmail.id,
          studentId: student.id,
          type: "birthday",
          year: currentYear,
          genderCategory: category,
          templateIndex,
        },
      });

      if (emailResult.success) {
        result.sent++;
      } else {
        result.failed++;
      }
    } catch {
      result.failed++;
    }
  }

  // Update campaign counts
  const sentCount = await prisma.emailLog.count({
    where: { templateKey: { startsWith: `birthday_` }, metadata: { path: ["campaignId"], equals: campaign.id } },
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { sentCount, totalRecipients: sentCount },
  });

  return result;
}
