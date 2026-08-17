/**
 * Prepaid session credit expiry — warnings, then forfeiture.
 *
 * The warning half already existed and had never run: `creditExpiryDays` was
 * never set, so `addCredits` stamped no `expiresAt`, so the WhatsApp 14/3-day
 * reminders had nothing to find. Nothing forfeited a lapsed credit either — the
 * balance simply stayed usable for ever, whatever the date on it said.
 *
 * Two halves here:
 *
 *   1. EMAIL warnings at 14 and 3 days. The existing warnings are WhatsApp-only
 *      and need `smsOptIn` plus a phone number, so a client without either would
 *      have lost credits they paid for with no notice at all. Email runs beside
 *      WhatsApp, not instead of it — the two channels dedupe separately.
 *
 *   2. Forfeiture on the day. Zeroes the balance and writes an `expired` ledger
 *      row, so the client's credit history says what happened rather than going
 *      quiet.
 *
 * Not marketing: this tells someone that something they PAID FOR is about to
 * lapse. It respects emailOptOut/emailPaused, and deliberately does not filter
 * on consentGiven — withholding it would be the unkind reading of consent.
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { appBaseUrl } from "@/lib/region";
import { saDateStr, saFormat, diffSaDays } from "@/lib/dates";

export interface CreditExpiryResult {
  warned14: number;
  warned3: number;
  expired: number;
  creditsForfeited: number;
  failures: number;
}

/**
 * A balance lapses only if it holds credits AND carries a date that has passed.
 *
 * `expiresAt === null` means "no expiry" and must never be read as "expired" —
 * every credit granted before `creditExpiryDays` was configured has a null here,
 * and treating those as lapsed would wipe balances people paid for.
 */
export function hasLapsed(
  balance: { balance: number; expiresAt: Date | null },
  now: Date,
): boolean {
  if (balance.balance <= 0) return false;
  if (balance.expiresAt === null) return false;
  return balance.expiresAt.getTime() <= now.getTime();
}

/**
 * Which warning a balance is due, if any. Returns null when it is outside both
 * windows — including when it has already lapsed, since a warning about an
 * expiry that has happened is worse than silence.
 */
export function warningDue(
  balance: { balance: number; expiresAt: Date | null },
  now: Date,
): "3d" | "14d" | null {
  if (balance.balance <= 0 || balance.expiresAt === null) return null;
  if (balance.expiresAt.getTime() <= now.getTime()) return null;
  const days = diffSaDays(now, balance.expiresAt);
  if (days <= 3) return "3d";
  if (days <= 14) return "14d";
  return null;
}

export async function processCreditExpiry(): Promise<CreditExpiryResult> {
  const result: CreditExpiryResult = {
    warned14: 0,
    warned3: 0,
    expired: 0,
    creditsForfeited: 0,
    failures: 0,
  };
  const now = new Date();
  const baseUrl = appBaseUrl();

  const balances = await prisma.sessionCreditBalance.findMany({
    where: { balance: { gt: 0 }, expiresAt: { not: null } },
    select: {
      id: true,
      studentId: true,
      balance: true,
      expiresAt: true,
      student: {
        select: {
          firstName: true,
          email: true,
          emailOptOut: true,
          emailPaused: true,
          unsubscribeToken: true,
        },
      },
    },
  });

  for (const cb of balances) {
    // ── Warnings ──────────────────────────────────────────────
    const due = warningDue(cb, now);
    if (due && cb.student && !cb.student.emailOptOut && !cb.student.emailPaused) {
      // Keyed by the EXPIRY DATE, not the month: a new grant pushes the date out
      // and starts a genuinely new cycle that deserves its own warning. Keyed by
      // month, that second cycle would have been silently suppressed.
      const templateKey = `credit_expiry_${due}_${cb.studentId}_${saDateStr(cb.expiresAt!)}`;

      // `status: "sent"` — sendEmail logs failures too, so matching on the key
      // alone would let one outage suppress the warning for good. This is the
      // same trap the drip/campaign idempotency fix had to undo.
      const alreadySent = await prisma.emailLog.findFirst({
        where: { templateKey, status: "sent" },
        select: { id: true },
      });

      if (!alreadySent) {
        try {
          const { subject, html } = await renderEmail(
            due === "3d" ? "credit_expiry_3d" : "credit_expiry_14d",
            {
              firstName: cb.student.firstName,
              creditCount: String(cb.balance),
              creditWord: cb.balance === 1 ? "credit" : "credits",
              expiryDate: saFormat(cb.expiresAt!, "d MMMM yyyy"),
              bookUrl: `${baseUrl}/book`,
            },
            baseUrl,
            cb.student.unsubscribeToken ?? undefined,
          );

          await sendEmail({
            to: cb.student.email,
            subject,
            html,
            templateKey,
            studentId: cb.studentId,
            metadata: {
              type: "credit_expiry_warning",
              window: due,
              credits: cb.balance,
              expiresAt: saDateStr(cb.expiresAt!),
            },
          });

          if (due === "3d") result.warned3++;
          else result.warned14++;
        } catch (err) {
          result.failures++;
          console.error(`[credit-expiry] ${due} warning failed for ${cb.student.email}:`, err);
        }
      }
    }

    // ── Forfeiture ────────────────────────────────────────────
    if (!hasLapsed(cb, now)) continue;

    try {
      // One transaction: the ledger row and the zeroing are the same fact. A
      // balance zeroed without its entry is a client's credits vanishing with no
      // explanation anywhere in the system.
      await prisma.$transaction([
        prisma.sessionCreditTransaction.create({
          data: {
            studentId: cb.studentId,
            type: "expired",
            amount: cb.balance,
            balanceAfter: 0,
            description: `${cb.balance} session ${cb.balance === 1 ? "credit" : "credits"} expired on ${saFormat(cb.expiresAt!, "d MMMM yyyy")}`,
          },
        }),
        prisma.sessionCreditBalance.update({
          where: { id: cb.id },
          // expiresAt cleared with the balance: left in place, the row would be
          // re-selected every night for ever, and a later grant would inherit a
          // date already in the past.
          data: {
            balance: 0,
            expiresAt: null,
            expiryWarning14: false,
            expiryWarning3: false,
          },
        }),
      ]);

      result.expired++;
      result.creditsForfeited += cb.balance;
    } catch (err) {
      result.failures++;
      console.error(`[credit-expiry] forfeit failed for student ${cb.studentId}:`, err);
    }
  }

  return result;
}
