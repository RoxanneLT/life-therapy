import type { SessionType } from "@/lib/generated/prisma/client";

export interface SessionTypeConfig {
  type: SessionType;
  label: string;
  description: string;
  durationMinutes: number;
  /** Whether this session type is free (no payment required). */
  isFree: boolean;
}

export const SESSION_TYPES: SessionTypeConfig[] = [
  {
    type: "free_consultation",
    label: "Free Consultation",
    description:
      "A no-obligation 30-minute introductory call to discuss your needs and how I can help.",
    durationMinutes: 30,
    isFree: true,
  },
  {
    type: "individual",
    label: "1:1 Individual Session",
    description:
      "A full 60-minute coaching or counselling session tailored to you.",
    durationMinutes: 60,
    isFree: false,
  },
  {
    type: "couples",
    label: "Couples Session",
    description:
      "A 60-minute couples coaching or counselling session for you and your partner.",
    durationMinutes: 60,
    isFree: false,
  },
];

export function getSessionTypeConfig(
  type: SessionType
): SessionTypeConfig {
  const config = SESSION_TYPES.find((s) => s.type === type);
  if (!config) throw new Error(`Unknown session type: ${type}`);
  return config;
}

// The business timezone is declared once, in lib/dates.ts. Re-exported here so
// the many existing `from "@/lib/booking-config"` imports keep working.
export { TIMEZONE } from "@/lib/dates";

/**
 * The fixed booking slot start times (HH:mm).
 * Each slot is 60 minutes long (regardless of actual session duration —
 * e.g. a 30-min consultation still occupies a full 60-min slot).
 * Pattern: 09:00, 10:15, 11:30, [lunch], 13:00, 14:15, 15:30
 */
export const ALLOWED_SLOT_START_TIMES = [
  "09:00",
  "10:15",
  "11:30",
  "13:00",
  "14:15",
  "15:30",
] as const;

export type SlotStartTime = (typeof ALLOWED_SLOT_START_TIMES)[number];

function isSlotStartTime(value: string): value is SlotStartTime {
  return (ALLOWED_SLOT_START_TIMES as readonly string[]).includes(value);
}

/**
 * Read a set of slot start times from anything a form or a stored row hands over.
 *
 * The one way a slot time is allowed to enter the system. Anything not in the list above is
 * dropped rather than corrected — an override naming a time no slot starts at would open a day
 * to nothing at all, which looks like a day that is simply fully booked and so is never reported.
 * Duplicates collapse and the result is ordered by the list, not by the order it was clicked, so
 * two overrides that open the same slots are the same row.
 *
 * Held by `availability: an override's open slots come from the list, never from the request`.
 */
export function parseSlotStartTimes(raw: string | readonly string[]): SlotStartTime[] {
  const parts = typeof raw === "string" ? raw.split(",") : raw;
  const wanted = new Set(parts.map((p) => p.trim()).filter(isSlotStartTime));
  return ALLOWED_SLOT_START_TIMES.filter((t) => wanted.has(t));
}
