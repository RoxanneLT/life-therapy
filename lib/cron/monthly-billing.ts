/**
 * Monthly postpaid billing processor.
 *
 * Checks today's date against three trigger points:
 *   1. Billing date -> generate payment requests + send emails
 *   2. Reminder date (2 business days before due) -> send friendly reminders
 *   3. Overdue date (1 business day after due) -> send overdue notices
 */

import { prisma } from "@/lib/prisma";
import {
  getEffectiveBillingDate,
  getReminderDate,
  getOverdueDate,
} from "@/lib/billing";
import { generateMonthlyPaymentRequests } from "@/lib/generate-payment-requests";
import {
  sendPaymentRequestEmail,
  sendPaymentReminder,
  sendDueTodayNotice,
  sendOverdueNotice,
} from "@/lib/send-invoice";
import { saToday, calendarDate, isSameSaDay } from "@/lib/dates";

/** Start of today's SAST calendar day, as a deterministic UTC-midnight Date. */
function getSASTToday(): Date {
  return calendarDate(saToday());
}

export async function processMonthlyBilling(): Promise<{
  billing: { generated: number } | null;
  /** Requests that existed but had never been emailed, rescued by the sweep in 1b.
   *  Reported separately from `billing` — a non-zero value here means a previous
   *  run died partway through its send loop, which is worth seeing in the digest. */
  sweptUnsent: { sent: number } | null;
  reminders: { sent: number } | null;
  dueToday: { sent: number } | null;
  overdue: { sent: number } | null;
}> {
  const today = getSASTToday();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const result: {
    billing: { generated: number } | null;
    sweptUnsent: { sent: number } | null;
    reminders: { sent: number } | null;
    dueToday: { sent: number } | null;
    overdue: { sent: number } | null;
  } = { billing: null, sweptUnsent: null, reminders: null, dueToday: null, overdue: null };

  // 1. Is today the effective billing date?
  const billingDate = getEffectiveBillingDate(year, month);
  if (isSameSaDay(today, billingDate)) {
    try {
      const requests = await generateMonthlyPaymentRequests(billingDate);

      for (const req of requests) {
        try {
          await sendPaymentRequestEmail(req.id);
        } catch (err) {
          console.error(`[monthly-billing] Failed to send email for request ${req.id}:`, err);
        }
      }

      result.billing = { generated: requests.length };
    } catch (err) {
      console.error("[monthly-billing] Failed to generate payment requests:", err);
      result.billing = { generated: 0 };
    }
  }

  // 1b. Sweep: any pending request that was CREATED but never emailed.
  //
  // Step 1 only runs on the billing date, and its send loop is not resumable — if
  // the daily cron died partway through it (timeout, deploy, provider wobble), the
  // PaymentRequests already existed but their emails never went out, and nothing
  // ever tried again. The client's first contact was then a "reminder" for an
  // invoice they had never received, or an overdue notice.
  //
  // `sentAt` is stamped by sendPaymentRequestEmail itself, so this sweep is
  // self-limiting: it can only ever pick up requests that genuinely never sent, and
  // it costs one indexed query on the days there are none.
  const neverSent = await prisma.paymentRequest.findMany({
    where: { status: "pending", sentAt: null },
    select: { id: true },
  });

  let sweptSent = 0;
  for (const req of neverSent) {
    try {
      await sendPaymentRequestEmail(req.id);
      sweptSent++;
      console.warn(`[monthly-billing] swept un-emailed payment request ${req.id}`);
    } catch (err) {
      console.error(`[monthly-billing] sweep failed for request ${req.id}:`, err);
    }
  }
  if (sweptSent > 0) {
    result.sweptUnsent = { sent: sweptSent };
  }

  // 2. Reminder check (2 business days before due for any unpaid request)
  const unpaidRequests = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      reminderSentAt: null,
    },
  });

  let remindersSent = 0;
  for (const req of unpaidRequests) {
    const reminderDate = getReminderDate(req.dueDate);
    if (isSameSaDay(today, reminderDate)) {
      try {
        await sendPaymentReminder(req.id);
        remindersSent++;
      } catch (err) {
        console.error(`[monthly-billing] Failed to send reminder for request ${req.id}:`, err);
      }
    }
  }
  if (remindersSent > 0) {
    result.reminders = { sent: remindersSent };
  }

  // 3. Due today check (on the actual due date)
  const dueTodayRequests = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      dueTodaySentAt: null,
    },
  });

  let dueTodaySent = 0;
  for (const req of dueTodayRequests) {
    if (isSameSaDay(today, req.dueDate)) {
      try {
        await sendDueTodayNotice(req.id);
        dueTodaySent++;
      } catch (err) {
        console.error(`[monthly-billing] Failed to send due-today notice for request ${req.id}:`, err);
      }
    }
  }
  if (dueTodaySent > 0) {
    result.dueToday = { sent: dueTodaySent };
  }

  // 4. Overdue check (1 business day after due for any still-unpaid request)
  const stillUnpaid = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      overdueSentAt: null,
    },
  });

  let overdueSent = 0;
  for (const req of stillUnpaid) {
    const overdueDate = getOverdueDate(req.dueDate);
    if (isSameSaDay(today, overdueDate)) {
      try {
        await sendOverdueNotice(req.id);
        overdueSent++;
      } catch (err) {
        console.error(`[monthly-billing] Failed to send overdue notice for request ${req.id}:`, err);
      }
    }
  }
  if (overdueSent > 0) {
    result.overdue = { sent: overdueSent };
  }

  return result;
}
