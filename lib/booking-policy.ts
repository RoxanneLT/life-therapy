import { fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/booking-config";

/** Cancel with >=48hr notice: credit refunded. */
export const CANCEL_NOTICE_HOURS = 48;
/** Reschedule with >=24hr notice. */
export const RESCHEDULE_NOTICE_HOURS = 24;
/** Max reschedules per booking. */
export const MAX_RESCHEDULES = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BookingData {
  status: string;
  date: Date | string;
  startTime: string;
  sessionType: string;
  rescheduleCount: number;
  rescheduledAt: Date | string | null;
  originalDate: Date | string | null;
  originalStartTime: string | null;
  policyOverride?: boolean;
}

export type CancelResult =
  | { allowed: true; type: "normal"; creditRefunded: true }
  | { allowed: true; type: "late"; creditRefunded: false }
  | { allowed: true; type: "anti_abuse"; creditRefunded: false }
  | { allowed: false; reason: string };

export type RescheduleResult =
  | { allowed: true }
  | { allowed: false; reason: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a SAST Date from a date + "HH:mm" time string. */
function buildSessionDateTime(date: Date | string, time: string): Date {
  const d = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  // fromZonedTime converts "wall clock in SAST" → UTC Date
  return fromZonedTime(`${d}T${time}:00`, TIMEZONE);
}

function hoursUntil(target: Date, now: Date): number {
  return (target.getTime() - now.getTime()) / (1000 * 60 * 60);
}

// ---------------------------------------------------------------------------
// Cancel evaluation
// ---------------------------------------------------------------------------

export function evaluateCancel(
  booking: BookingData,
  now = new Date()
): CancelResult {
  // Only pending/confirmed bookings can be cancelled
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { allowed: false, reason: "Only pending or confirmed bookings can be cancelled." };
  }

  const sessionStart = buildSessionDateTime(booking.date, booking.startTime);

  // Session already started / in the past
  if (sessionStart <= now) {
    return { allowed: false, reason: "Cannot cancel a session that has already started." };
  }

  const hours = hoursUntil(sessionStart, now);

  // Admin policy override — treat as normal cancel (credit refunded)
  if (booking.policyOverride) {
    return { allowed: true, type: "normal", creditRefunded: true };
  }

  // Anti-abuse: booking was rescheduled AND original session was within the cancel window
  // at the time of reschedule. This detects "reschedule to dodge late-cancel penalty".
  if (booking.rescheduledAt && booking.originalDate && booking.originalStartTime) {
    const originalStart = buildSessionDateTime(
      booking.originalDate,
      booking.originalStartTime
    );
    const rescheduledAt =
      typeof booking.rescheduledAt === "string"
        ? new Date(booking.rescheduledAt)
        : booking.rescheduledAt;

    // Check if the original session was <48hr from when they rescheduled
    const hoursFromRescheduleToOriginal =
      (originalStart.getTime() - rescheduledAt.getTime()) / (1000 * 60 * 60);

    if (hoursFromRescheduleToOriginal < CANCEL_NOTICE_HOURS) {
      return { allowed: true, type: "anti_abuse", creditRefunded: false };
    }
  }

  // Standard: >=48hr = normal (refund), <48hr = late (forfeit)
  if (hours >= CANCEL_NOTICE_HOURS) {
    return { allowed: true, type: "normal", creditRefunded: true };
  }

  return { allowed: true, type: "late", creditRefunded: false };
}

// ---------------------------------------------------------------------------
// Reschedule evaluation
// ---------------------------------------------------------------------------

export function evaluateReschedule(
  booking: BookingData,
  now = new Date()
): RescheduleResult {
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { allowed: false, reason: "Only pending or confirmed bookings can be rescheduled." };
  }

  const sessionStart = buildSessionDateTime(booking.date, booking.startTime);

  if (sessionStart <= now) {
    return { allowed: false, reason: "Cannot reschedule a session that has already started." };
  }

  if (booking.rescheduleCount >= MAX_RESCHEDULES && !booking.policyOverride) {
    return {
      allowed: false,
      reason: `This booking has already been rescheduled ${MAX_RESCHEDULES} times.`,
    };
  }

  const hours = hoursUntil(sessionStart, now);
  const isFreeConsultation = booking.sessionType === "free_consultation";
  if (!isFreeConsultation && !booking.policyOverride && hours < RESCHEDULE_NOTICE_HOURS) {
    return {
      allowed: false,
      reason: "Rescheduling requires at least 24 hours notice.",
    };
  }

  return { allowed: true };
}
