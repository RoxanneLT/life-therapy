import { prisma } from "@/lib/prisma";
import {
  getSiteSettings,
  getBusinessHours,
  type BusinessHoursDay,
} from "@/lib/settings";
import { getFreeBusy } from "@/lib/graph";
import { TIMEZONE, type SessionTypeConfig } from "@/lib/booking-config";
import { addDays, eachDayOfInterval } from "date-fns";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

export interface TimeSlot {
  start: string; // "09:00"
  end: string; // "09:30"
}

const DAY_MAP: Record<number, string> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

// "09:30" → 570
function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// 570 → "09:30"
function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const a0 = parseTime(aStart);
  const a1 = parseTime(aEnd);
  const b0 = parseTime(bStart);
  const b1 = parseTime(bEnd);
  return a0 < b1 && b0 < a1;
}

// Fixed time slots as specified by the client.
// Same start times regardless of session duration (30 or 60 min).
const FIXED_SLOT_STARTS = ["09:00", "10:15", "11:30", "13:00", "14:15", "15:30"];

function generateSlots(
  open: string,
  close: string,
  duration: number,
  _buffer: number
): TimeSlot[] {
  const openMin = parseTime(open);
  const closeMin = parseTime(close);

  return FIXED_SLOT_STARTS
    .filter((start) => {
      const startMin = parseTime(start);
      return startMin >= openMin && startMin + duration <= closeMin;
    })
    .map((start) => ({
      start,
      end: formatTime(parseTime(start) + duration),
    }));
}

function isoToTimeString(iso: string): string {
  // Extract HH:mm from ISO or datetime string
  const match = iso.match(/T?(\d{2}):(\d{2})/);
  if (!match) return "00:00";
  return `${match[1]}:${match[2]}`;
}

/**
 * Get available time slots for a specific date and session type.
 * @param dateStr — SAST calendar date string, e.g. "2026-02-10"
 */
export async function getAvailableSlots(
  dateStr: string,
  sessionConfig: SessionTypeConfig
): Promise<TimeSlot[]> {
  const settings = await getSiteSettings();
  const businessHours = getBusinessHours(settings);

  // 1. Day of week — use noon UTC to avoid any date-boundary ambiguity
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const dayKey = DAY_MAP[noonUtc.getUTCDay()];
  const dayHours: BusinessHoursDay = businessHours[dayKey];
  if (dayHours.closed) return [];

  // 2. Check availability override — midnight UTC for @db.Date
  const dateUtc = new Date(`${dateStr}T00:00:00Z`);
  const override = await prisma.availabilityOverride.findUnique({
    where: { date: dateUtc },
  });
  if (override?.isBlocked) return [];

  const openTime = override?.startTime || dayHours.open;
  const closeTime = override?.endTime || dayHours.close;

  // 3. Generate candidate slots with buffer between sessions
  const slotDuration = sessionConfig.durationMinutes;
  const buffer = settings.bookingBufferMinutes ?? 15;
  const candidates = generateSlots(openTime, closeTime, slotDuration, buffer);

  if (candidates.length === 0) return [];

  // 4. Get Exchange calendar busy times (proper UTC boundaries for SAST day)
  const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
  const dayEndUtc = fromZonedTime(`${dateStr}T23:59:59`, TIMEZONE);
  const busyTimes = await getFreeBusy(dayStartUtc, dayEndUtc);

  // 5. Get existing bookings from our DB (resilience layer)
  const existingBookings = await prisma.booking.findMany({
    where: {
      date: dateUtc,
      status: { in: ["pending", "confirmed"] },
    },
    select: { startTime: true, endTime: true },
  });

  // 6. Filter out unavailable slots
  const nowMs = Date.now();
  const minNoticeMs =
    (settings.bookingMinNoticeHours ?? 24) * 60 * 60 * 1000;

  const available = candidates.filter((slot) => {
    // Minimum notice — convert SAST slot time to UTC ms for comparison
    const slotUtc = fromZonedTime(`${dateStr}T${slot.start}:00`, TIMEZONE);
    if (slotUtc.getTime() - nowMs < minNoticeMs) return false;

    // Check Exchange busy times
    for (const busy of busyTimes) {
      const busyStart = isoToTimeString(busy.start);
      const busyEnd = isoToTimeString(busy.end);
      // Include buffer around busy times
      const busyStartWithBuffer = formatTime(
        Math.max(0, parseTime(busyStart) - buffer)
      );
      const busyEndWithBuffer = formatTime(parseTime(busyEnd) + buffer);
      if (
        timeRangesOverlap(
          slot.start,
          slot.end,
          busyStartWithBuffer,
          busyEndWithBuffer
        )
      ) {
        return false;
      }
    }

    // Check existing bookings (with buffer)
    for (const booking of existingBookings) {
      const bookingStartWithBuffer = formatTime(
        Math.max(0, parseTime(booking.startTime) - buffer)
      );
      const bookingEndWithBuffer = formatTime(
        parseTime(booking.endTime) + buffer
      );
      if (
        timeRangesOverlap(
          slot.start,
          slot.end,
          bookingStartWithBuffer,
          bookingEndWithBuffer
        )
      ) {
        return false;
      }
    }

    return true;
  });

  return available;
}

export async function getAvailableDates(): Promise<string[]> {
  const settings = await getSiteSettings();

  if (!settings.bookingEnabled) return [];

  const maxDays = settings.bookingMaxAdvanceDays ?? 30;
  const businessHours = getBusinessHours(settings);

  // Today in SAST — use formatInTimeZone for correct date regardless of server TZ
  const todaySast = formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");

  // Start from tomorrow SAST, span maxDays
  const start = addDays(new Date(`${todaySast}T12:00:00Z`), 1);
  const end = addDays(start, maxDays);

  // Get all overrides in range (use UTC midnight for @db.Date)
  const startUtc = new Date(
    `${formatInTimeZone(start, "UTC", "yyyy-MM-dd")}T00:00:00Z`
  );
  const endUtc = new Date(
    `${formatInTimeZone(end, "UTC", "yyyy-MM-dd")}T00:00:00Z`
  );
  const overrides = await prisma.availabilityOverride.findMany({
    where: { date: { gte: startUtc, lte: endUtc } },
  });
  const overrideMap = new Map(
    overrides.map((o) => [
      formatInTimeZone(o.date, "UTC", "yyyy-MM-dd"),
      o,
    ])
  );

  const dates = eachDayOfInterval({ start, end });

  const availableDates = dates.filter((d) => {
    const dateStr = formatInTimeZone(d, "UTC", "yyyy-MM-dd");
    const noonUtc = new Date(`${dateStr}T12:00:00Z`);
    const dayKey = DAY_MAP[noonUtc.getUTCDay()];
    const dayHours = businessHours[dayKey];
    const override = overrideMap.get(dateStr);

    // Blocked override = unavailable
    if (override?.isBlocked) return false;
    // Closed day without override = unavailable
    if (dayHours.closed && !override) return false;
    // Open day with custom override hours, or regular open day
    return true;
  });

  return availableDates.map((d) => formatInTimeZone(d, "UTC", "yyyy-MM-dd"));
}
