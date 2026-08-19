/**
 * Is this sequenced step due for this contact YET?
 *
 * ── The incident this exists to prevent ──────────────────────────────────────
 * A multi-step campaign decided "is this step due?" from one clock only:
 * `daysSinceActivation >= dayOffset`. That is correct for a campaign activated
 * recently — step 3 waits until day 14 and so on. It is catastrophic for an old one.
 * Two campaigns activated 156 days earlier had EVERY step already past its offset, so
 * every step was due simultaneously, and the only thing left pacing the sequence was how
 * often the cron happened to run. `campaign_steps` runs every two hours. On 2026-08-19,
 * 68 emails reached 28 clients in a single day; fourteen of them received three.
 *
 * The trigger was unrelated and benign — 28 wrongly-paused clients were restored, which
 * put them back into candidacy for campaigns nobody had thought about in five months.
 *
 * ── The rule ─────────────────────────────────────────────────────────────────
 * A step is due when BOTH clocks agree:
 *
 *   1. the schedule has reached it — `daysSinceStart >= dayOffset`; and
 *   2. this CONTACT has waited the step's own spacing since their last one.
 *
 * The second clock is the one that was missing, and `lastSentAt` was already written on
 * every send and never read — the guard was one field lookup away the whole time.
 *
 * Spacing is taken from the campaign's OWN configuration: the gap between step N-1's
 * offset and step N's is what the author asked for. No constant is invented here, because
 * an invented constant is a second opinion about cadence and would drift from the one the
 * admin can see and edit.
 *
 * The floor of one day is what makes cron frequency irrelevant. Two steps sharing an
 * offset — or a schedule long overdue — can still only advance once per day, so running
 * the processor hourly, two-hourly or daily produces the same client experience. A
 * pacing rule that can be changed by a cron setting is not a pacing rule.
 */
import { diffSaDays } from "@/lib/dates";

export interface PacingInput {
  /** Days since the sequence started for this contact — activation, or signup for drip. */
  daysSinceStart: number;
  /** This step's configured offset, in days from the start. */
  dayOffset: number;
  /** The PREVIOUS step's offset, or null when this is the first step. */
  prevDayOffset: number | null;
  /** When this contact last received a step of this sequence. */
  lastSentAt: Date | null;
  now: Date;
}

export type PacingVerdict = { due: boolean; reason: string };

/** Never less than a day between two steps, whatever the schedule says. */
export const MIN_STEP_GAP_DAYS = 1;

/** The spacing this step was configured to have. */
export function intendedGapDays(dayOffset: number, prevDayOffset: number | null): number {
  const configured = dayOffset - (prevDayOffset ?? 0);
  return Math.max(MIN_STEP_GAP_DAYS, configured);
}

export function stepIsDue(input: PacingInput): PacingVerdict {
  const { daysSinceStart, dayOffset, prevDayOffset, lastSentAt, now } = input;

  if (daysSinceStart < dayOffset) {
    return { due: false, reason: `scheduled for day ${dayOffset}, currently day ${daysSinceStart}` };
  }

  // First step for this contact: the schedule is the only clock that applies.
  if (!lastSentAt) return { due: true, reason: "first step for this contact" };

  const gap = intendedGapDays(dayOffset, prevDayOffset);
  // diffSaDays, not division by 86_400_000: 23:00 Monday to 08:00 Tuesday is one calendar
  // day and floors to zero, which would let a step through a few hours early every time.
  const waited = diffSaDays(lastSentAt, now);
  if (waited < gap) {
    return { due: false, reason: `last step ${waited}d ago, this one is spaced ${gap}d` };
  }

  return { due: true, reason: `${waited}d since the last step, spacing is ${gap}d` };
}
