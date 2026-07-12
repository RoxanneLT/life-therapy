/**
 * WhatsApp reminder processor — runs as part of the daily cron.
 *
 * Date-based categories only (08:00 SAST is the right time for these):
 *   1. Billing reminders (request sent, 2 days before due, overdue)
 *   2. Credit expiry warnings (14 days + 3 days before)
 *
 * Session reminders (24h + ~2h before) are time-of-day sensitive and live
 * in lib/cron/session-reminders.ts, triggered by the every-2h reminders cron.
 *
 * Tracking fields on each record prevent duplicate sends.
 */

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { sendAndLogTemplate } from "@/lib/whatsapp";
import {
  getEffectiveBillingDate,
  getReminderDate,
  getOverdueDate,
} from "@/lib/billing";
import { saToday, calendarDate, isSameSaDay } from "@/lib/dates";
import { addDays, format } from "date-fns";
import { formatPrice } from "@/lib/utils";

// ─── Helpers ─────────────────────────────────────────────────

/** Start of today's SAST calendar day, as a deterministic UTC-midnight Date. */
function getSASTToday(): Date {
  return calendarDate(saToday());
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

  // 1. New payment requests — send on billing date
  let sentRequest = 0;
  const pendingNew = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      whatsappSentAt: null,
      studentId: { not: null },
    },
  });

  const billingDate = getEffectiveBillingDate(today.getFullYear(), today.getMonth() + 1);

  if (isSameSaDay(today, billingDate)) {
    for (const pr of pendingNew) {
      const contact = await resolveStudentPhone(pr.studentId);
      if (!contact) continue;

      const monthLabel = format(new Date(pr.periodEnd), "MMMM yyyy");
      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
      const result = await sendAndLogTemplate({
        studentId: contact.studentId,
        phone: contact.phone,
        templateName: "billing_request",
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: contact.firstName },
            { type: "text", text: monthLabel },
            { type: "text", text: formatPrice(pr.totalCents, pr.currency) },
            { type: "text", text: format(pr.dueDate, "d MMMM yyyy") },
            { type: "text", text: pr.paymentUrl || portalUrl },
          ],
        }],
        metadata: { paymentRequestId: pr.id },
      });

      if (result.success) {
        await prisma.paymentRequest.update({
          where: { id: pr.id },
          data: { whatsappSentAt: new Date() },
        });
        sentRequest++;
      }
    }
  }

  // 2. Payment reminder — 2 business days before due
  let sentReminder = 0;
  const unpaid = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      whatsappReminderSentAt: null,
      studentId: { not: null },
    },
  });

  for (const pr of unpaid) {
    const reminderDate = getReminderDate(pr.dueDate);
    if (!isSameSaDay(today, reminderDate)) continue;

    const contact = await resolveStudentPhone(pr.studentId);
    if (!contact) continue;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
    const result = await sendAndLogTemplate({
      studentId: contact.studentId,
      phone: contact.phone,
      templateName: "billing_reminder",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: contact.firstName },
          { type: "text", text: formatPrice(pr.totalCents, pr.currency) },
          { type: "text", text: format(pr.dueDate, "d MMMM yyyy") },
          { type: "text", text: pr.paymentUrl || portalUrl },
        ],
      }],
      metadata: { paymentRequestId: pr.id },
    });

    if (result.success) {
      await prisma.paymentRequest.update({
        where: { id: pr.id },
        data: { whatsappReminderSentAt: new Date() },
      });
      sentReminder++;
    }
  }

  // 3. Due today notice — on the actual due date
  let sentDueToday = 0;
  const dueTodayPending = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      whatsappDueTodaySentAt: null,
      studentId: { not: null },
    },
  });

  for (const pr of dueTodayPending) {
    if (!isSameSaDay(today, pr.dueDate)) continue;

    const contact = await resolveStudentPhone(pr.studentId);
    if (!contact) continue;

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
    const result = await sendAndLogTemplate({
      studentId: contact.studentId,
      phone: contact.phone,
      templateName: "billing_due_today",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: contact.firstName },
          { type: "text", text: formatPrice(pr.totalCents, pr.currency) },
          { type: "text", text: pr.paymentUrl || portalUrl },
        ],
      }],
      metadata: { paymentRequestId: pr.id },
    });

    if (result.success) {
      await prisma.paymentRequest.update({
        where: { id: pr.id },
        data: { whatsappDueTodaySentAt: new Date() },
      });
      sentDueToday++;
    }
  }

  // 4. Overdue notice — 1 business day after due
  let sentOverdue = 0;
  const stillUnpaid = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      whatsappOverdueSentAt: null,
      studentId: { not: null },
    },
  });

  for (const pr of stillUnpaid) {
    const overdueDate = getOverdueDate(pr.dueDate);
    if (!isSameSaDay(today, overdueDate)) continue;

    const contact = await resolveStudentPhone(pr.studentId);
    if (!contact) continue;

    const monthLabel = format(new Date(pr.periodEnd), "MMMM yyyy");
    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/invoices`;
    const result = await sendAndLogTemplate({
      studentId: contact.studentId,
      phone: contact.phone,
      templateName: "billing_overdue",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: contact.firstName },
          { type: "text", text: formatPrice(pr.totalCents, pr.currency) },
          { type: "text", text: monthLabel },
          { type: "text", text: pr.paymentUrl || portalUrl },
        ],
      }],
      metadata: { paymentRequestId: pr.id },
    });

    if (result.success) {
      await prisma.paymentRequest.update({
        where: { id: pr.id },
        data: { whatsappOverdueSentAt: new Date() },
      });
      sentOverdue++;
    }
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

    const result = await sendAndLogTemplate({
      studentId: cb.studentId,
      phone: cb.student.phone,
      templateName: "credits_expiry_14d",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: cb.student.firstName },
          { type: "text", text: String(cb.balance) },
          { type: "text", text: format(cb.expiresAt, "d MMMM yyyy") },
        ],
      }],
    });

    if (result.success) {
      await prisma.sessionCreditBalance.update({
        where: { id: cb.id },
        data: { expiryWarning14: true },
      });
      sent14d++;
    }
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

    const result = await sendAndLogTemplate({
      studentId: cb.studentId,
      phone: cb.student.phone,
      templateName: "credits_expiry_3d",
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: cb.student.firstName },
          { type: "text", text: String(cb.balance) },
          { type: "text", text: format(cb.expiresAt, "d MMMM yyyy") },
        ],
      }],
    });

    if (result.success) {
      await prisma.sessionCreditBalance.update({
        where: { id: cb.id },
        data: { expiryWarning3: true },
      });
      sent3d++;
    }
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
