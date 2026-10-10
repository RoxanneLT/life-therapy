/**
 * WhatsApp reminder processor — runs as part of the daily cron (Vercel, 06:00 UTC; it
 * starts at ~08:46 SAST, measured 2026-09-30 — inside lib/quiet-hours.ts's window already,
 * so this file does not gate on it: a gate here would only lose the day on a late re-run).
 *
 * Date-based categories only:
 *   1. Billing reminders (request sent, 2 days before due, due today, overdue)
 *   2. Credit expiry warnings (14 days + 3 days before)
 *
 * Session reminders (24h + ~2h before) are time-of-day sensitive and live
 * in lib/cron/session-reminders.ts.
 *
 * Every send CLAIMS its stamp first (one conditional update) and releases it on failure,
 * so two overlapping runs cannot both send. Until 2026-09-30 these read, sent, then stamped.
 */

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { sendAndLogTemplate } from "@/lib/whatsapp";
import {
  getEffectiveBillingDate,
  getReminderDate,
  getOverdueDate,
  loadRequestAmounts,
} from "@/lib/billing";
import { saToday, saFormat, calendarDate, isSameSaDay } from "@/lib/dates";
import { addDays } from "date-fns";
import { formatPrice } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────

/** Start of today's SAST calendar day, as a deterministic UTC-midnight Date. */
function getSASTToday(): Date {
  return calendarDate(saToday());
}

type PaymentRequestStamp =
  | "whatsappSentAt"
  | "whatsappReminderSentAt"
  | "whatsappDueTodaySentAt"
  | "whatsappOverdueSentAt";
type CreditWarning = "expiryWarning14" | "expiryWarning3";
type Send = () => Promise<{ success: boolean }>;

/** Claim → send → release on failure. Only the run whose conditional update matched sends. */
async function sendOnce(
  claim: () => Promise<{ count: number }>,
  release: () => Promise<unknown>,
  send: Send,
): Promise<boolean> {
  if ((await claim()).count !== 1) return false;
  try {
    if ((await send()).success) return true;
  } catch (err) {
    console.error("[whatsapp-reminders] send threw:", err);
  }
  await release().catch((err) => console.error("[whatsapp-reminders] release failed:", err));
  return false;
}

function onceForRequest(id: string, field: PaymentRequestStamp, send: Send): Promise<boolean> {
  return sendOnce(
    () => prisma.paymentRequest.updateMany({ where: { id, [field]: null }, data: { [field]: new Date() } }),
    () => prisma.paymentRequest.updateMany({ where: { id }, data: { [field]: null } }),
    send,
  );
}

function onceForCredit(id: string, field: CreditWarning, send: Send): Promise<boolean> {
  return sendOnce(
    () => prisma.sessionCreditBalance.updateMany({ where: { id, [field]: false }, data: { [field]: true } }),
    () => prisma.sessionCreditBalance.updateMany({ where: { id }, data: { [field]: false } }),
    send,
  );
}

// ─── Billing Reminders ───────────────────────────────────────

async function resolveStudentPhone(
  studentId: string | null,
): Promise<{ phone: string; studentId: string; firstName: string } | null> {
  if (!studentId) return null;
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, firstName: true, phone: true, smsOptIn: true },
  });
  if (!student?.smsOptIn || !student.phone) return null;
  return { phone: student.phone, studentId: student.id, firstName: student.firstName };
}

async function processBillingReminders(
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
): Promise<{ sentRequest: number; sentReminder: number; sentDueToday: number; sentOverdue: number }> {
  if (!settings.whatsappEnabled || !settings.whatsappBillingReminders) {
    return { sentRequest: 0, sentReminder: 0, sentDueToday: 0, sentOverdue: 0 };
  }

  const today = getSASTToday();
  // A request an admin put on hold is not chased here either: the email chaser honours
  // chasePausedUntil (monthly-billing.ts) and these four steps did not (walk-oct-fixes 01, F8).
  const notPaused = () => ({ OR: [{ chasePausedUntil: null }, { chasePausedUntil: { lte: new Date() } }] });

  // 1. New payment requests — send on billing date
  let sentRequest = 0;
  const pendingNew = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      whatsappSentAt: null,
      studentId: { not: null },
      ...notPaused(),
    },
  });

  const billingDate = getEffectiveBillingDate(today.getFullYear(), today.getMonth() + 1);

  if (isSameSaDay(today, billingDate)) {
    for (const pr of pendingNew) {
      const contact = await resolveStudentPhone(pr.studentId);
      if (!contact) continue;

      const monthLabel = saFormat(pr.periodEnd, "MMMM yyyy");
      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
      // The balance, not the original total — a WhatsApp that asks a client for
      // money they already paid is the one they screenshot.
      const { balance } = await loadRequestAmounts(pr);
      const sent = await onceForRequest(pr.id, "whatsappSentAt", () => sendAndLogTemplate({
        studentId: contact.studentId,
        phone: contact.phone,
        templateName: "billing_request",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: contact.firstName },
            { type: "text", text: monthLabel },
            { type: "text", text: formatPrice(balance, pr.currency) },
            { type: "text", text: saFormat(pr.dueDate, "d MMMM yyyy") },
            { type: "text", text: pr.paymentUrl || portalUrl },
          ],
        }],
        metadata: { paymentRequestId: pr.id },
      }));
      if (sent) sentRequest++;
    }
  }

  // 2. Payment reminder — 2 business days before due
  let sentReminder = 0;
  const unpaid = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      whatsappReminderSentAt: null,
      studentId: { not: null },
      ...notPaused(),
    },
  });

  for (const pr of unpaid) {
    const reminderDate = getReminderDate(pr.dueDate);
    if (!isSameSaDay(today, reminderDate)) continue;

    const contact = await resolveStudentPhone(pr.studentId);
    if (!contact) continue;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
    const { balance } = await loadRequestAmounts(pr);
    const sent = await onceForRequest(pr.id, "whatsappReminderSentAt", () => sendAndLogTemplate({
      studentId: contact.studentId,
      phone: contact.phone,
      templateName: "billing_reminder",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: contact.firstName },
          { type: "text", text: formatPrice(balance, pr.currency) },
          { type: "text", text: saFormat(pr.dueDate, "d MMMM yyyy") },
          { type: "text", text: pr.paymentUrl || portalUrl },
        ],
      }],
      metadata: { paymentRequestId: pr.id },
    }));
    if (sent) sentReminder++;
  }

  // 3. Due today notice — on the actual due date
  let sentDueToday = 0;
  const dueTodayPending = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      whatsappDueTodaySentAt: null,
      studentId: { not: null },
      ...notPaused(),
    },
  });

  for (const pr of dueTodayPending) {
    if (!isSameSaDay(today, pr.dueDate)) continue;

    const contact = await resolveStudentPhone(pr.studentId);
    if (!contact) continue;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
    const { balance } = await loadRequestAmounts(pr);
    const sent = await onceForRequest(pr.id, "whatsappDueTodaySentAt", () => sendAndLogTemplate({
      studentId: contact.studentId,
      phone: contact.phone,
      templateName: "billing_due_today",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: contact.firstName },
          { type: "text", text: formatPrice(balance, pr.currency) },
          { type: "text", text: pr.paymentUrl || portalUrl },
        ],
      }],
      metadata: { paymentRequestId: pr.id },
    }));
    if (sent) sentDueToday++;
  }

  // 4. Overdue notice — 1 business day after due
  let sentOverdue = 0;
  // Pending OR overdue. The email chaser runs first in the daily cron and marks the request
  // "overdue" when it sends its own notice, on this same day — so reading "pending" alone hid
  // nearly every request from this step, whose window is that one day. The email step fixed
  // the same trap for itself (monthly-billing.ts); this is its WhatsApp twin.
  const stillUnpaid = await prisma.paymentRequest.findMany({
    where: {
      status: { in: ["pending", "overdue"] },
      whatsappOverdueSentAt: null,
      studentId: { not: null },
      ...notPaused(),
    },
  });

  for (const pr of stillUnpaid) {
    const overdueDate = getOverdueDate(pr.dueDate);
    if (!isSameSaDay(today, overdueDate)) continue;

    const contact = await resolveStudentPhone(pr.studentId);
    if (!contact) continue;

    const monthLabel = saFormat(pr.periodEnd, "MMMM yyyy");
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
    const { balance } = await loadRequestAmounts(pr);
    const sent = await onceForRequest(pr.id, "whatsappOverdueSentAt", () => sendAndLogTemplate({
      studentId: contact.studentId,
      phone: contact.phone,
      templateName: "billing_overdue",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: contact.firstName },
          { type: "text", text: formatPrice(balance, pr.currency) },
          { type: "text", text: monthLabel },
          { type: "text", text: pr.paymentUrl || portalUrl },
        ],
      }],
      metadata: { paymentRequestId: pr.id },
    }));
    if (sent) sentOverdue++;
  }

  return { sentRequest, sentReminder, sentDueToday, sentOverdue };
}

// ─── Credit Expiry Reminders ─────────────────────────────────

async function processCreditExpiryReminders(
  settings: Awaited<ReturnType<typeof getSiteSettings>>,
): Promise<{ sent14d: number; sent3d: number }> {
  if (!settings.whatsappEnabled || !settings.whatsappCreditReminders) {
    return { sent14d: 0, sent3d: 0 };
  }

  const today = getSASTToday();
  const in14Days = addDays(today, 14);
  const in3Days = addDays(today, 3);

  // 14-day warning
  const expiring14d = await prisma.sessionCreditBalance.findMany({
    where: {
      balance: { gt: 0 },
      expiresAt: { lte: in14Days, gt: in3Days },
      expiryWarning14: false,
    },
    include: { student: true },
  });

  let sent14d = 0;
  for (const cb of expiring14d) {
    if (!cb.student.smsOptIn || !cb.student.phone || !cb.expiresAt) continue;

    const { expiresAt } = cb;
    const { phone } = cb.student;
    const sent = await onceForCredit(cb.id, "expiryWarning14", () => sendAndLogTemplate({
      studentId: cb.studentId,
      phone,
      templateName: "credits_expiry_14d",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: cb.student.firstName },
          { type: "text", text: String(cb.balance) },
          { type: "text", text: saFormat(expiresAt, "d MMMM yyyy") },
        ],
      }],
    }));
    if (sent) sent14d++;
  }

  // 3-day warning
  const expiring3d = await prisma.sessionCreditBalance.findMany({
    where: {
      balance: { gt: 0 },
      expiresAt: { lte: in3Days, gt: today },
      expiryWarning3: false,
    },
    include: { student: true },
  });

  let sent3d = 0;
  for (const cb of expiring3d) {
    if (!cb.student.smsOptIn || !cb.student.phone || !cb.expiresAt) continue;

    const { expiresAt } = cb;
    const { phone } = cb.student;
    const sent = await onceForCredit(cb.id, "expiryWarning3", () => sendAndLogTemplate({
      studentId: cb.studentId,
      phone,
      templateName: "credits_expiry_3d",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: cb.student.firstName },
          { type: "text", text: String(cb.balance) },
          { type: "text", text: saFormat(expiresAt, "d MMMM yyyy") },
        ],
      }],
    }));
    if (sent) sent3d++;
  }

  return { sent14d, sent3d };
}

// ─── Main export ─────────────────────────────────────────────

export async function processWhatsAppReminders(): Promise<{
  billingReminders: { sentRequest: number; sentReminder: number; sentDueToday: number; sentOverdue: number };
  creditReminders: { sent14d: number; sent3d: number };
}> {
  const settings = await getSiteSettings();

  const billingReminders = await processBillingReminders(settings);
  const creditReminders = await processCreditExpiryReminders(settings);

  return { billingReminders, creditReminders };
}
