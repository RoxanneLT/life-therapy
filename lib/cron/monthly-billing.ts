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
import { saToday, calendarDate, saDateStr, isSameSaDay, diffSaDays } from "@/lib/dates";

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
  /** Requests where chasing is deliberately held because payment is expected. */
  chaseHeld?: { count: number };
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
    chaseHeld?: { count: number };
  } = { billing: null, sweptUnsent: null, reminders: null, dueToday: null, overdue: null };

  // 1. Is today the effective billing date? Deliberately still an EQUALITY — the
  //    chases below became thresholds so a missed day recovers, but GENERATING
  //    requests must happen on exactly one day or every later run bills again.
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
  // A THRESHOLD, not an equality.
  //
  // Every chase used `isSameSaDay(today, <its day>)`, so each one had exactly one
  // day in which it could ever fire. Miss that day — a run that dies early, a
  // request created after its own reminder date, a deploy at the wrong hour — and
  // that client is never chased again, because the send is also one-shot. The
  // sweep added for the never-emailed case doesn't cover this: those requests
  // WERE emailed, they just went quiet afterwards.
  //
  // (An earlier version of this comment claimed no due-today or overdue notice
  // had ever been sent. That was wrong — they fire, and the records show the full
  // four-step sequence on real requests. The genuine defect is the one fixed in
  // step 4 below: chasing STOPS after the first overdue notice. Correcting it
  // here because a wrong comment outlives the person who wrote it.)
  //
  // The window stays bounded so the wording still matches the moment: a reminder
  // is only a reminder until the money is actually due.
  for (const req of unpaidRequests) {
    // Held: money is on its way and cannot be recorded yet. Chasing someone who
    // has already paid is the failure this exists to prevent.
    if (req.chasePausedUntil && req.chasePausedUntil > new Date()) continue;

    const reminderDate = getReminderDate(req.dueDate);
    if (saDateStr(today) >= saDateStr(reminderDate) && saDateStr(today) < saDateStr(req.dueDate)) {
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
    // Held: money is on its way and cannot be recorded yet. Chasing someone who
    // has already paid is the failure this exists to prevent.
    if (req.chasePausedUntil && req.chasePausedUntil > new Date()) continue;

    // From the due date until the overdue notice takes over. "Due today" a day
    // late still reads true enough; a week late does not, and by then the
    // overdue notice is the honest one to send.
    if (
      saDateStr(today) >= saDateStr(req.dueDate) &&
      saDateStr(today) < saDateStr(getOverdueDate(req.dueDate))
    ) {
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

  // 4. Overdue — the first notice, and then a weekly nudge while it stays unpaid.
  //
  // Two things ended chasing dead after one email. `sendOverdueNotice` sets
  // status to "overdue", and every query here filtered `status: "pending"` — so
  // the moment a request was chased it became invisible to all further chasing.
  // Cyle Davids was contacted on 8 July and never again; the money arrived on
  // 17 August, forty days later, after a human noticed.
  //
  // So: include the requests already marked overdue, and re-send weekly. Capped,
  // because an unlimited chaser is how a practice ends up hounding someone who
  // is having a hard month — after four notices it stops and stays in the
  // digest for a person to deal with.
  const stillUnpaid = await prisma.paymentRequest.findMany({
    where: { status: { in: ["pending", "overdue"] } },
  });

  const REPEAT_EVERY_DAYS = 7;
  const MAX_NOTICES = 4;

  let overdueSent = 0;
  for (const req of stillUnpaid) {
    // Held: money is on its way and cannot be recorded yet. Chasing someone who
    // has already paid is the failure this exists to prevent.
    if (req.chasePausedUntil && req.chasePausedUntil > new Date()) continue;

    const overdueDate = getOverdueDate(req.dueDate);
    if (saDateStr(today) < saDateStr(overdueDate)) continue;

    try {
      if (!req.overdueSentAt) {
        // First notice. Open-ended on the day so a missed run recovers.
        await sendOverdueNotice(req.id);
        overdueSent++;
        continue;
      }

      if (diffSaDays(req.overdueSentAt, today) < REPEAT_EVERY_DAYS) continue;

      // How many have already gone out, counted from what was actually
      // DELIVERED — a failed send must not consume one of the four.
      const alreadySent = await prisma.emailLog.count({
        where: {
          templateKey: "payment_request_overdue",
          status: "sent",
          metadata: { path: ["paymentRequestId"], equals: req.id },
        },
      });
      if (alreadySent >= MAX_NOTICES) continue;

      await sendOverdueNotice(req.id, { repeat: true });
      overdueSent++;
    } catch (err) {
      console.error(`[monthly-billing] Failed to send overdue notice for request ${req.id}:`, err);
    }
  }
  if (overdueSent > 0) {
    result.overdue = { sent: overdueSent };
  }

  // A hold must never be silent — that is how a paused invoice becomes a forgotten
  // one. Reported so it appears in the nightly digest for as long as it is held.
  const held = await prisma.paymentRequest.count({
    where: { status: { in: ["pending", "overdue"] }, chasePausedUntil: { gt: new Date() } },
  });
  if (held > 0) result.chaseHeld = { count: held };

  return result;
}
