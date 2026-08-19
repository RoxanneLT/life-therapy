/**
 * Who counts as a cold contact, and what a cold contact may still be sent.
 *
 * ── Why this file exists ─────────────────────────────────────────────────────
 * The cold-contact rule paused a client after 5 consecutive unopened emails, and
 * "unopened" meant the tracking pixel never loaded. Outlook blocks remote images
 * by default; Apple Mail pre-fetches them. So the signal measures the mail client,
 * not the human — and the numbers showed it: of 2,230 tracked sends only 33%
 * ever registered an open, and 65 of 181 students had been auto-paused, every
 * single one by the automatic rule and not one by a person.
 *
 * A client whose mail app blocks images is paused with CERTAINTY, however
 * carefully they read. The practice owner was paused on 2026-03-16 that way and
 * stopped receiving her own system's birthday email — which is how this surfaced,
 * five months later.
 *
 * Two corrections live here:
 *
 *   1. A missing pixel is no longer sufficient. A click, or real activity in the
 *      account, outranks it — those cannot be produced by an image blocker.
 *   2. An automatic pause is OUR marketing hygiene, not the client's wish, so it
 *      no longer suppresses a birthday wish or a warning that paid credits are
 *      about to expire. Consent and opt-out ARE the client's wish and still bind —
 *      see the three tiers below, which are not the same line.
 *
 * One implementation, deliberately: `lib/drip-emails.ts` and `lib/campaign-process.ts`
 * each grew their own copy — one keyed by studentId, one by email, with different
 * thresholds hardcoded — so a correction to either reached half the senders.
 */
import { prisma } from "@/lib/prisma";
import { saToday, addSaDays, saDayStart, calendarDate } from "@/lib/dates";

/** Consecutive unopened tracked emails before the cold rule may consider a pause. */
export const COLD_THRESHOLD = 5;

/**
 * How far back real activity still counts. A quarter is a therapy-practice
 * judgement, not a general constant: clients commonly pause between blocks of
 * sessions and return, and treating a six-week gap as disengagement is what the
 * old rule effectively did.
 */
export const ENGAGEMENT_WINDOW_DAYS = 90;

/**
 * Reasons written by the automatic rule. Matched as a PATTERN, not a fixed string:
 * the reason embeds the threshold (`5_consecutive_unopened`), so a future change to
 * COLD_THRESHOLD would otherwise orphan every row already written with the old
 * number and silently reclassify those clients as manually paused.
 */
const AUTO_PAUSE_REASON = /^\d+_consecutive_unopened$/;

export interface PauseState {
  emailPaused: boolean;
  emailPauseReason: string | null;
}

/**
 * What a marketing decision needs. Deliberately NOT including the pause reason:
 * marketing stops at any pause, so asking why would be a question whose answer
 * cannot change the outcome — and a caller forced to select a column it does not
 * need is a caller that starts selecting whole rows.
 */
export interface ConsentFlags {
  consentGiven: boolean;
  emailOptOut: boolean;
  emailPaused: boolean;
}

/** What a goodwill decision needs: the flags, plus WHY the record is paused. */
export type ConsentState = ConsentFlags & { emailPauseReason: string | null };

/** Was this pause applied by the cold rule rather than by a person? */
export function isAutoPaused(s: PauseState): boolean {
  return s.emailPaused && AUTO_PAUSE_REASON.test(s.emailPauseReason ?? "");
}

/**
 * ── Three tiers, because "not marketing" is not one category ─────────────────
 *
 * MARKETING   campaigns, drip, newsletters — anything promotional.
 * GOODWILL    a birthday wish. Not promotional, but optional and unasked-for, so
 *             an explicit unsubscribe must stop it. Nobody who said "stop emailing
 *             me" wants a cheerful birthday note as the exception.
 * ACCOUNT     the client's own money and bookings — credits about to expire, an
 *             invoice, a confirmation. Service mail, not consent-bound: you cannot
 *             unsubscribe from being told the sessions you paid for lapse on Friday.
 *
 * The distinction that caused the incident cuts a different way from the obvious
 * one: it is not marketing-vs-rest, it is WHOSE DECISION suppressed the send. Consent
 * and opt-out are the client's and bind according to tier. An automatic pause is our
 * own marketing hygiene and binds only to marketing.
 */

/** Campaigns, drip, newsletters. An auto-pause is exactly what this is for. */
export function mayReceiveMarketing(s: ConsentFlags): boolean {
  return s.consentGiven && !s.emailOptOut && !s.emailPaused;
}

/**
 * A birthday wish. Consent and opt-out bind — a client who unsubscribed gets no
 * birthday email, deliberately. Only the AUTOMATIC pause is set aside, because that
 * was never the client's decision; a pause a person applied is honoured, which is
 * why this asks WHY the record is paused rather than whether it is.
 */
export function mayReceiveGoodwill(s: ConsentState): boolean {
  if (!s.consentGiven || s.emailOptOut) return false;
  return !s.emailPaused || isAutoPaused(s);
}

/**
 * Expiring credits, invoices, booking confirmations — mail about the client's own
 * account. Deliberately unconditional, and a named predicate rather than an absent
 * check so the decision is greppable and has somewhere to live if a hard-bounce
 * suppression is ever added.
 *
 * Reading `_s` and ignoring it is the point: the argument documents what was
 * considered and rejected. Credit-expiry warnings previously honoured opt-out and
 * pause, so a client with images disabled in Outlook could lose paid-for sessions
 * with no warning — silently at both ends, because nothing told anyone either.
 */
export function mayReceiveAccountNotice(_s?: Partial<ConsentFlags>): boolean {
  return true;
}

export interface EngagementFacts {
  /** Tracked emails found, capped at COLD_THRESHOLD. */
  trackedCount: number;
  anyOpened: boolean;
  anyClicked: boolean;
  hasRecentActivity: boolean;
}

export interface ColdVerdict {
  cold: boolean;
  /** Why — carried so the digest can say more than a number. */
  reason: string;
}

/**
 * The decision, separated from the queries so it can be tested exhaustively without
 * a database. Order matters: the cheapest positive evidence of a live human wins.
 */
export function decideCold(f: EngagementFacts): ColdVerdict {
  if (f.trackedCount < COLD_THRESHOLD) {
    return { cold: false, reason: `only ${f.trackedCount} tracked emails — too few to judge` };
  }
  if (f.anyOpened) return { cold: false, reason: "opened a recent email" };
  // A click requires a human and a real request; an image blocker cannot suppress
  // one into existence, which is precisely what it does to opens.
  if (f.anyClicked) return { cold: false, reason: "clicked a recent email" };
  if (f.hasRecentActivity) {
    return { cold: false, reason: `active in the account within ${ENGAGEMENT_WINDOW_DAYS} days` };
  }
  return { cold: true, reason: `${COLD_THRESHOLD}_consecutive_unopened` };
}

/**
 * Gather the facts and decide. Keyed by studentId AND email: `emailLog.studentId` is
 * nullable and older rows do not carry it, so keying on one alone under-counts a
 * client's history — and under-counting history is what pushes someone over the
 * threshold.
 */
export async function assessEngagement(studentId: string, email: string): Promise<ColdVerdict> {
  const recent = await prisma.emailLog.findMany({
    where: {
      status: "sent",
      trackingId: { not: null },
      OR: [{ studentId }, { to: email }],
    },
    orderBy: { sentAt: "desc" },
    take: COLD_THRESHOLD,
    select: { openedAt: true, clickedAt: true },
  });

  const facts: EngagementFacts = {
    trackedCount: recent.length,
    anyOpened: recent.some((e) => e.openedAt !== null),
    anyClicked: recent.some((e) => e.clickedAt !== null),
    hasRecentActivity: false,
  };

  // Only pay for the activity queries if the cheap signals have already failed.
  if (facts.trackedCount >= COLD_THRESHOLD && !facts.anyOpened && !facts.anyClicked) {
    facts.hasRecentActivity = await hasRecentActivity(studentId);
  }

  return decideCold(facts);
}

/**
 * Did this client actually do anything lately? A booking made or coming up, or an
 * order placed. `date` is a `@db.Date` calendar day and `createdAt` a real instant,
 * so they are compared against differently-built cutoffs — the two are not
 * interchangeable (§9).
 */
async function hasRecentActivity(studentId: string): Promise<boolean> {
  const since = addSaDays(saToday(), -ENGAGEMENT_WINDOW_DAYS);
  const sinceInstant = saDayStart(since);
  const sinceDay = calendarDate(since);

  const [bookings, orders] = await Promise.all([
    prisma.booking.count({
      where: {
        studentId,
        // A session booked recently, or one still to come: either is a live client.
        OR: [{ createdAt: { gte: sinceInstant } }, { date: { gte: sinceDay } }],
      },
    }),
    prisma.order.count({ where: { studentId, createdAt: { gte: sinceInstant } } }),
  ]);

  return bookings > 0 || orders > 0;
}
