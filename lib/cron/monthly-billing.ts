/**
 * Monthly postpaid billing processor.
 *
 * Checks today's date against three trigger points:
 *   1. Billing date -> generate payment requests + send emails
 *   2. Reminder date (2 business days before due) -> send friendly reminders
 *   3. Overdue date (1 business day after due) -> send overdue notices
 */

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import {
  getEffectiveBillingDate,
  getReminderDate,
  getOverdueDate,
} from "@/lib/billing";
import { generateMonthlyPaymentRequests } from "@/lib/generate-payment-requests";
import {
  sendPaymentRequestEmail,
  sendPaymentReminder,
  sendOverdueNotice,
} from "@/lib/send-invoice";
import { formatInTimeZone } from "date-fns-tz";

const TIMEZONE = "Africa/Johannesburg";

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getSASTToday(): Date {
  const nowStr = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
  return new Date(`${nowStr}T00:00:00`);
}

export async function processMonthlyBilling(): Promise<{
  billing: { generated: number } | null;
  reminders: { sent: number } | null;
  overdue: { sent: number } | null;
}> {
  const settings = await getSiteSettings();
  const today = getSASTToday();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  const result: {
    billing: { generated: number } | null;
    reminders: { sent: number } | null;
    overdue: { sent: number } | null;
  } = { billing: null, reminders: null, overdue: null };

  // 1. Is today the effective billing date?
  const billingDate = getEffectiveBillingDate(year, month, settings.postpaidBillingDay);
  if (isSameDay(today, billingDate)) {
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
    if (isSameDay(today, reminderDate)) {
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

  // 3. Overdue check (1 business day after due for any still-unpaid request)
  const stillUnpaid = await prisma.paymentRequest.findMany({
    where: {
      status: "pending",
      overdueSentAt: null,
    },
  });

  let overdueSent = 0;
  for (const req of stillUnpaid) {
    const overdueDate = getOverdueDate(req.dueDate);
    if (isSameDay(today, overdueDate)) {
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
