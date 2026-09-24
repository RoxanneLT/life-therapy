import { prisma } from "@/lib/prisma";
import {
  getSiteSettings,
  getBusinessHours,
  type BusinessHoursDay,
} from "@/lib/settings";
import { getFreeBusy, MAX_FREE_BUSY_DAYS } from "@/lib/graph";
import {
  ALLOWED_SLOT_START_TIMES,
  SESSION_TYPES,
  type SessionTypeConfig,
} from "@/lib/booking-config";
import { addDays, eachDayOfInterval } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { saToday, saInstant, saDayStart, saDayEnd, calendarDate } from "@/lib/dates";
import { isSAPublicHolidayOn } from "@/lib/sa-holidays";

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

// The slot start times come from lib/booking-config.ts and are declared nowhere else. This file
// held its own copy of the same six times until 2026-09-24, and that copy was the one deciding
// what could be booked, while `ALLOWED_SLOT_START_TIMES` drew the admin day and week views. Two
// lists, no mechanism between them: editing the documented one moved every admin screen and left
// the booking engine on the old times, which reads as a working change and is not one. Held by
// `slots: one list of slot start times`.

// `open`/`close` are null when no window applies: a day that is closed in business hours and
// opened by an override has no stored window to read. Its `open`/`close` are whatever was last
// saved for a day nobody works — the defaults say 09:00–13:00 for Saturday — so honouring them
// would silently drop the afternoon slots from a day the admin deliberately opened. Null means
// every slot, and the override's own startTime/endTime narrow it when the admin sets them.
function generateSlots(
  open: string | null,
  close: string | null,
  duration: number,
  _buffer: number
): TimeSlot[] {
  const openMin = open === null ? null : parseTime(open);
  const closeMin = close === null ? null : parseTime(close);

  return ALLOWED_SLOT_START_TIMES
    .filter((start) => {
      const startMin = parseTime(start);
      if (openMin !== null && startMin < openMin) return false;
      if (closeMin !== null && startMin + duration > closeMin) return false;
      return true;
    })
    .map((start) => ({
      start,
      end: formatTime(parseTime(start) + duration),
    }));
}

function isoToTimeString(timeStr: string): string {
  // Graph now returns "HH:mm" SAST strings directly, but handle legacy ISO format too
  const match = timeStr.match(/(\d{2}):(\d{2})/);
  if (!match) return "00:00";
  return `${match[1]}:${match[2]}`;
}

/** What an override says about one day. Only the fields a slot decision reads. */
interface DayOverride {
  isBlocked: boolean;
  startTime: string | null;
  endTime: string | null;
  openSlots: string[];
  reason: string | null;
}

interface DayInputs {
  dateStr: string;
  dayHours: BusinessHoursDay;
  override: DayOverride | null;
  /** Graph busy ranges falling on this day, and this day only. */
  busy: { start: string; end: string }[];
  /** Bookings held on this day in our own DB. */
  bookings: { startTime: string; endTime: string }[];
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeMs: number;
  nowMs: number;
  skipMinNotice: boolean;
}

/**
 * Every rule about what can be booked on one day, in one place.
 *
 * This is the whole reason the function exists: getAvailableSlots and getAvailableDates used to
 * each carry their own subset, and they disagreed — a day the date list offered could turn out to
 * have no times on it, and until 2026-09-24 an override could open a Saturday in one and not the
 * other. A date is now offered if and only if this returns something for it, because it is the
 * same call. Pure: everything it reads is an argument, so one fetch can answer a whole window.
 */
function slotsForDay(i: DayInputs): { slots: TimeSlot[]; closedReason: string | null } {
  const { dateStr, dayHours, override } = i;
  const shut = (closedReason: string) => ({ slots: [], closedReason });

  // An override is read BEFORE the closed-day test, not after: every reason a day is shut — the
  // weekday, a public holiday — yields to one, because that is what an override is for. Recurring
  // series have skipped holidays since they were built; single bookings never checked, so
  // Christmas Day was offered on the public form. Held by `availability: a closed day yields to
  // an override`.
  // The reason travels with the refusal, because the admin screens that reschedule a whole series
  // need to say WHY a date was skipped, and the only alternative was each of them re-deriving the
  // answer by hand — which is exactly how two of them ended up checking holidays and blocks while
  // knowing nothing about business hours or an override's open slots.
  if (override?.isBlocked) {
    return shut(`Day blocked${override.reason ? `: ${override.reason}` : ""}`);
  }
  if (dayHours.closed && !override) return shut("Closed that day");
  if (isSAPublicHolidayOn(dateStr) && !override) return shut("Public holiday");

  const openTime = override?.startTime || (dayHours.closed ? null : dayHours.open);
  const closeTime = override?.endTime || (dayHours.closed ? null : dayHours.close);
  const windowed = generateSlots(openTime, closeTime, i.durationMinutes, i.bufferMinutes);

  // An override may open only the slots the admin ticked. Empty means the whole day, which is what
  // every override meant before the column existed — so an old row and a "full day" row are the
  // same row, and neither needs a second flag to say which it is.
  const openSlots: readonly string[] = override?.openSlots ?? [];
  const candidates =
    openSlots.length > 0 ? windowed.filter((s) => openSlots.includes(s.start)) : windowed;
  if (candidates.length === 0) return shut("No slot fits that day's hours");

  const buffer = i.bufferMinutes;
  const blockedRanges = [
    ...i.busy.map((b) => {
      const start = parseTime(isoToTimeString(b.start));
      const end = parseTime(isoToTimeString(b.end));
      return { start: formatTime(Math.max(0, start - buffer)), end: formatTime(end + buffer) };
    }),
    ...i.bookings.map((b) => ({
      start: formatTime(Math.max(0, parseTime(b.startTime) - buffer)),
      end: formatTime(parseTime(b.endTime) + buffer),
    })),
  ];

  const slots = candidates.filter((slot) => {
    const slotUtc = saInstant(dateStr, slot.start);
    if (!i.skipMinNotice && slotUtc.getTime() - i.nowMs < i.minNoticeMs) return false;
    return !blockedRanges.some((r) => timeRangesOverlap(slot.start, slot.end, r.start, r.end));
  });

  // No closedReason when the day was open and simply filled: the day's shape allowed it and
  // something already booked took it. The callers that care say so in their own words.
  return { slots, closedReason: null };
}

/**
 * Which slot start times a day OFFERS, before anything is booked into them, and why none if none.
 *
 * For callers that already know about occupancy and were missing the day's shape — the series
 * reschedule, which checked public holidays and a blocked override by hand and knew nothing about
 * business hours or an override that opens only some slots. It asks the same `slotsForDay` the
 * booking form asks, with the occupancy inputs empty, so there is one answer to "is this day open
 * at this time" and no second copy to drift.
 *
 * Held by `availability: nothing works out a day's shape by hand`.
 */
export async function getDayOpening(
  dateStr: string,
  durationMinutes: number,
): Promise<{ starts: string[]; closedReason: string | null }> {
  const settings = await getSiteSettings();
  const businessHours = getBusinessHours(settings);
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);

  const override = await prisma.availabilityOverride.findUnique({
    where: { date: calendarDate(dateStr) },
  });

  const { slots, closedReason } = slotsForDay({
    dateStr,
    dayHours: businessHours[DAY_MAP[noonUtc.getUTCDay()]],
    override,
    busy: [],
    bookings: [],
    durationMinutes,
    bufferMinutes: settings.bookingBufferMinutes ?? 15,
    minNoticeMs: 0,
    nowMs: Date.now(),
    skipMinNotice: true,
  });

  return { starts: slots.map((s) => s.start), closedReason };
}

/**
 * Get available time slots for a specific date and session type.
 * @param dateStr — SAST calendar date string, e.g. "2026-02-10"
 */
export async function getAvailableSlots(
  dateStr: string,
  sessionConfig: SessionTypeConfig,
  options?: { skipMinNotice?: boolean }
): Promise<{ slots: TimeSlot[]; freeBusyFailed: boolean }> {
  const settings = await getSiteSettings();
  const businessHours = getBusinessHours(settings);

  // Noon UTC to avoid any date-boundary ambiguity; midnight UTC for the @db.Date column.
  const noonUtc = new Date(`${dateStr}T12:00:00Z`);
  const dayHours: BusinessHoursDay = businessHours[DAY_MAP[noonUtc.getUTCDay()]];
  const dateUtc = calendarDate(dateStr);

  const override = await prisma.availabilityOverride.findUnique({
    where: { date: dateUtc },
  });

  const { slots: busy, failed: freeBusyFailed } = await getFreeBusy(
    saDayStart(dateStr),
    saDayEnd(dateStr),
  );

  // Our own bookings are the resilience layer: they hold when Graph does not answer.
  const bookings = await prisma.booking.findMany({
    where: { date: dateUtc, status: { in: ["pending", "confirmed"] } },
    select: { startTime: true, endTime: true },
  });

  const { slots } = slotsForDay({
    dateStr,
    dayHours,
    override,
    busy,
    bookings,
    durationMinutes: sessionConfig.durationMinutes,
    bufferMinutes: settings.bookingBufferMinutes ?? 15,
    minNoticeMs: (settings.bookingMinNoticeHours ?? 24) * 60 * 60 * 1000,
    nowMs: Date.now(),
    skipMinNotice: options?.skipMinNotice ?? false,
  });

  return { slots, freeBusyFailed };
}

/**
 * Ask Graph for busy ranges across a whole window, in chunks it will accept.
 *
 * `getSchedule` refuses more than MAX_FREE_BUSY_DAYS with `ErrorTimeIntervalTooBig` — measured
 * 2026-09-24 — and the admin date list asks for 90. A refusal returns `failed`, which reads as
 * "the calendar is unreachable" and so opens every slot it should have closed, silently. One
 * chunk failing marks the whole answer failed: a partial busy list is worse than no busy list,
 * because it is believed.
 */
async function busyAcrossWindow(
  startUtc: Date,
  endUtc: Date,
): Promise<{ byDate: Map<string, { start: string; end: string }[]>; failed: boolean }> {
  const byDate = new Map<string, { start: string; end: string }[]>();
  let failed = false;

  for (let from = startUtc; from < endUtc; ) {
    const to = new Date(
      Math.min(from.getTime() + MAX_FREE_BUSY_DAYS * 86400000, endUtc.getTime()),
    );
    const { slots, failed: chunkFailed } = await getFreeBusy(from, to);
    if (chunkFailed) failed = true;
    for (const s of slots) {
      const day = byDate.get(s.date);
      if (day) day.push(s);
      else byDate.set(s.date, [s]);
    }
    from = to;
  }

  return { byDate, failed };
}

/**
 * The days a booking can actually be made on.
 *
 * A date is offered only if a slot is left on it. Until 2026-09-24 this asked whether the day was
 * OPEN and never whether anything remained, so a fully booked day sat in the client's picker and
 * answered "no times available" when clicked — and a day Roxanne had filled in Outlook did the
 * same. Being open and being bookable are different questions, and this is the one the picker is
 * actually asking.
 *
 * The cost of asking it properly is two queries and a small number of Graph calls for the whole
 * window, not per day: the overrides in one query, the bookings in one, the busy ranges in
 * ceil(days / 60) calls. Then `slotsForDay` decides each day from memory — the same call
 * getAvailableSlots makes, so the two cannot drift apart again.
 */
export async function getAvailableDates(options?: {
  includeToday?: boolean;
  maxDaysOverride?: number;
  /** Admin books inside the notice period; the public does not. Mirrors getAvailableSlots. */
  skipMinNotice?: boolean;
  /** Slot length to test the day against. Defaults to the longest session type. */
  sessionConfig?: SessionTypeConfig;
}): Promise<string[]> {
  const settings = await getSiteSettings();

  if (!settings.bookingEnabled) return [];

  const maxDays = options?.maxDaysOverride ?? settings.bookingMaxAdvanceDays ?? 60;
  const businessHours = getBusinessHours(settings);

  // Today in SAST — use formatInTimeZone for correct date regardless of server TZ
  const todaySast = saToday();

  // Start from today (admin) or tomorrow (public), span maxDays
  const start = options?.includeToday
    ? new Date(`${todaySast}T12:00:00Z`)
    : addDays(new Date(`${todaySast}T12:00:00Z`), 1);
  const end = addDays(start, maxDays);

  // Get all overrides in range (use UTC midnight for @db.Date). `start`/`end` are
  // noon anchors, so their UTC day is already the SAST day — read it back as UTC.
  const startStr = formatInTimeZone(start, "UTC", "yyyy-MM-dd");
  const endStr = formatInTimeZone(end, "UTC", "yyyy-MM-dd");
  const startUtc = calendarDate(startStr);
  const endUtc = calendarDate(endStr);
  const overrides = await prisma.availabilityOverride.findMany({
    where: { date: { gte: startUtc, lte: endUtc } },
  });
  const overrideMap = new Map(
    overrides.map((o) => [formatInTimeZone(o.date, "UTC", "yyyy-MM-dd"), o]),
  );

  const bookings = await prisma.booking.findMany({
    where: { date: { gte: startUtc, lte: endUtc }, status: { in: ["pending", "confirmed"] } },
    select: { date: true, startTime: true, endTime: true },
  });
  const bookingMap = new Map<string, { startTime: string; endTime: string }[]>();
  for (const b of bookings) {
    const key = formatInTimeZone(b.date, "UTC", "yyyy-MM-dd");
    const day = bookingMap.get(key);
    if (day) day.push(b);
    else bookingMap.set(key, [b]);
  }

  const { byDate: busyMap } = await busyAcrossWindow(saDayStart(startStr), saDayEnd(endStr));

  // The longest session is the honest default: a day with room for an hour has room for a
  // half-hour consultation, and offering a date that only fits the shorter one would put the
  // client back where they started. Callers that know the session type pass it.
  const durationMinutes =
    options?.sessionConfig?.durationMinutes ??
    Math.max(...SESSION_TYPES.map((s) => s.durationMinutes));

  const bufferMinutes = settings.bookingBufferMinutes ?? 15;
  const minNoticeMs = (settings.bookingMinNoticeHours ?? 24) * 60 * 60 * 1000;
  const nowMs = Date.now();

  const available: string[] = [];
  for (const d of eachDayOfInterval({ start, end })) {
    const dateStr = formatInTimeZone(d, "UTC", "yyyy-MM-dd");
    const noonUtc = new Date(`${dateStr}T12:00:00Z`);
    const { slots } = slotsForDay({
      dateStr,
      dayHours: businessHours[DAY_MAP[noonUtc.getUTCDay()]],
      override: overrideMap.get(dateStr) ?? null,
      busy: busyMap.get(dateStr) ?? [],
      bookings: bookingMap.get(dateStr) ?? [],
      durationMinutes,
      bufferMinutes,
      minNoticeMs,
      nowMs,
      skipMinNotice: options?.skipMinNotice ?? false,
    });
    if (slots.length > 0) available.push(dateStr);
  }

  return available;
}
