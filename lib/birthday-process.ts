import { prisma } from "@/lib/prisma";
import { escapeTemplateVariables, replacePlaceholders } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";
import { saToday } from "@/lib/dates";
import { appBaseUrl } from "@/lib/region";
import { mayReceiveGoodwill } from "@/lib/engagement";

const DEFAULT_BASE_URL = appBaseUrl();

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

  // Today in SAST. The daily cron fires at 06:00 UTC, four hours clear of the
  // 22:00 UTC day-flip, so the old local getters happened to agree — but only by
  // luck of the schedule. `templateKey` below dedupes on currentYear, so this
  // must not drift on 31 December.
  const [currentYear, todayMonth, todayDay] = saToday().split("-").map(Number);

  // Find all students whose birthday is today
  // Consent and opt-out are filtered in SQL — they are the client's own decisions
  // and bind here. The PAUSE is filtered in code by `mayReceiveGoodwill`, because
  // the answer depends on WHY the record is paused: an automatic cold-contact pause
  // is our marketing hygiene and must not swallow a birthday wish, while a pause a
  // person applied is honoured. Filtering `emailPaused: false` in SQL, as this did,
  // could not tell those apart — which is how the practice owner's own birthday
  // email stopped arriving after an image-blocking mail client got her auto-paused.
  const allStudents = await prisma.student.findMany({
    where: {
      dateOfBirth: { not: null },
      consentGiven: true,
      emailOptOut: false,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      gender: true,
      dateOfBirth: true,
      unsubscribeToken: true,
      consentGiven: true,
      emailOptOut: true,
      emailPaused: true,
      emailPauseReason: true,
      clientStatus: true,
    },
  });

  const birthdayStudents = allStudents.filter((s) => {
    if (!s.dateOfBirth) return false;
    if (!mayReceiveGoodwill(s)) return false;
    // dateOfBirth is a `@db.Date` held at UTC midnight, so read it with the UTC
    // getters. The local ones would shift it a day on any server west of GMT.
    const dob = new Date(s.dateOfBirth);
    return dob.getUTCMonth() + 1 === todayMonth && dob.getUTCDate() === todayDay;
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
    // Idempotency: check if already sent this year. `status: "sent"` matters —
    // sendEmail() also logs FAILURES, and this key is per-YEAR: a failed send
    // without the filter meant the client got no birthday email until the next
    // birthday. See the same note in lib/drip-emails.ts.
    const alreadySent = await prisma.emailLog.findFirst({
      where: { templateKey, to: student.email, status: "sent" },
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
    // Escaped before substitution. These placeholders carry client-supplied values —
    // firstName reaches the database from the PUBLIC booking form and the
    // unauthenticated newsletter signup — and this file has its OWN copy of
    // replacePlaceholders, so the escaping added at renderEmail never covered it.
    // Five copies of that function exist across lib/; #18 fixed exactly one.
    const safeVariables = escapeTemplateVariables(variables);

    const subject = replacePlaceholders(selectedEmail.subject, safeVariables);
    let bodyHtml = replacePlaceholders(selectedEmail.bodyHtml, safeVariables);

    // Add CTA if defined
    if (selectedEmail.ctaText && selectedEmail.ctaUrl) {
      let ctaUrl = replacePlaceholders(selectedEmail.ctaUrl, safeVariables);
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

  // Update campaign counts. Attempts and DELIVERIES are different numbers, and
  // this counted every attempt as a send — so a provider outage showed as a
  // campaign that reached everyone. `sentCount` is what actually went out;
  // `totalRecipients` is who it was tried on.
  const scope = {
    templateKey: { startsWith: `birthday_` },
    metadata: { path: ["campaignId"], equals: campaign.id },
  };
  const [sentCount, totalRecipients] = await Promise.all([
    prisma.emailLog.count({ where: { ...scope, status: "sent" } }),
    prisma.emailLog.count({ where: scope }),
  ]);

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { sentCount, totalRecipients },
  });

  return result;
}
