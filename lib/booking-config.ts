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

export const TIMEZONE = "Africa/Johannesburg";

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
