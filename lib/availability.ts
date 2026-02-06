import { prisma } from "@/lib/prisma";
import {
  getSiteSettings,
  getBusinessHours,
  type BusinessHoursDay,
} from "@/lib/settings";
import { getFreeBusy } from "@/lib/graph";
import { TIMEZONE, type SessionTypeConfig } from "@/lib/booking-config";
import {
  format,
  addDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
} from "date-fns";
import { toZonedTime } from "date-fns-tz";

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

function generateSlots(
  open: string,
  close: string,
  duration: number,
  buffer: number
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  let current = parseTime(open);
  const end = parseTime(close);

  while (current + duration <= end) {
    slots.push({
      start: formatTime(current),
      end: formatTime(current + duration),
    });
    current += duration + buffer;
  }

  return slots;
}

function isoToTimeString(iso: string): string {
  // Extract HH:mm from ISO or datetime string
  const match = iso.match(/T?(\d{2}):(\d{2})/);
  if (!match) return "00:00";
  return `${match[1]}:${match[2]}`;
}

export async function getAvailableSlots(
  date: Date,
  sessionConfig: SessionTypeConfig
): Promise<TimeSlot[]> {
  const settings = await getSiteSettings();
  const businessHours = getBusinessHours(settings);

  // 1. Get base hours for this day of week
  const dayKey = DAY_MAP[date.getDay()];
  const dayHours: BusinessHoursDay = businessHours[dayKey];
  if (dayHours.closed) return [];

  // 2. Check availability override for this specific date
  const dateStart = startOfDay(date);
  const override = await prisma.availabilityOverride.findUnique({
    where: { date: dateStart },
  });
  if (override?.isBlocked) return [];

  const openTime = override?.startTime || dayHours.open;
  const closeTime = override?.endTime || dayHours.close;

  // 3. Generate candidate slots with buffer between sessions
  const slotDuration = sessionConfig.durationMinutes;
  const buffer = settings.bookingBufferMinutes ?? 15;
  const candidates = generateSlots(openTime, closeTime, slotDuration, buffer);

  if (candidates.length === 0) return [];

  // 4. Get Exchange calendar busy times
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);
  const busyTimes = await getFreeBusy(dayStart, dayEnd);

  // 5. Get existing bookings from our DB (resilience layer)
  const existingBookings = await prisma.booking.findMany({
    where: {
      date: dateStart,
      status: { in: ["pending", "confirmed"] },
    },
    select: { startTime: true, endTime: true },
  });

  // 6. Filter out unavailable slots
  const now = toZonedTime(new Date(), TIMEZONE);
  const minNoticeMs =
    (settings.bookingMinNoticeHours ?? 24) * 60 * 60 * 1000;

  const available = candidates.filter((slot) => {
    // Check minimum notice
    const slotDate = new Date(date);
    const [h, m] = slot.start.split(":").map(Number);
    slotDate.setHours(h, m, 0, 0);
    if (slotDate.getTime() - now.getTime() < minNoticeMs) return false;

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

  const now = toZonedTime(new Date(), TIMEZONE);
  const start = addDays(startOfDay(now), 1); // tomorrow at earliest
  const end = addDays(start, maxDays);

  // Get all overrides in range
  const overrides = await prisma.availabilityOverride.findMany({
    where: { date: { gte: start, lte: end } },
  });
  const overrideMap = new Map(
    overrides.map((o) => [format(o.date, "yyyy-MM-dd"), o])
  );

  const dates = eachDayOfInterval({ start, end });

  const availableDates = dates.filter((d) => {
    const dayKey = DAY_MAP[d.getDay()];
    const dayHours = businessHours[dayKey];
    const dateStr = format(d, "yyyy-MM-dd");
    const override = overrideMap.get(dateStr);

    // Blocked override = unavailable
    if (override?.isBlocked) return false;
    // Closed day without override = unavailable
    if (dayHours.closed && !override) return false;
    // Open day with custom override hours, or regular open day
    return true;
  });

  return availableDates.map((d) => format(d, "yyyy-MM-dd"));
}
