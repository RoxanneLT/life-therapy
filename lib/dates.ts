/**
 * lib/dates.ts — the single place that knows about the business timezone.
 *
 * Two rules, and every bug in this area comes from confusing them:
 *
 *   A **calendar date** ("2026-07-08") is a day, not a moment. Build it at UTC
 *   midnight so Prisma `@db.Date` columns round-trip cleanly — `calendarDate()`.
 *
 *   A **real instant** (`createdAt`, `paidAt`, `new Date()`) is a moment, not a
 *   day. You must resolve it through the timezone before you can call it a day —
 *   `saDateStr()`. Slicing its ISO string gives you the *UTC* day, which is wrong
 *   for two hours every night (22:00–24:00 UTC is already tomorrow in SAST).
 *
 * Note: SAST has no DST, but never hardcode "+02:00" — go through TIMEZONE so
 * there is exactly one thing to change if that ever stops being true.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** The business timezone. This module owns it; other modules import from here. */
export const TIMEZONE = "Africa/Johannesburg";

/**
 * Format an instant in SAST. The generic escape hatch — reach for the named
 * helpers below first, and use this only for patterns they don't cover.
 * Never `format()` a Date for display: that renders in the *server's* timezone.
 */
export function saFormat(date: Date | string, pattern: string): string {
  return formatInTimeZone(new Date(date), TIMEZONE, pattern);
}

/** A real instant → the SAST calendar day it falls on, as "yyyy-MM-dd". */
export function saDateStr(date: Date | string): string {
  return saFormat(date, "yyyy-MM-dd");
}

/** Today's SAST calendar day, as "yyyy-MM-dd". */
export function saToday(): string {
  return saDateStr(new Date());
}

/**
 * A SAST wall-clock date + time → the real instant it refers to.
 * `time` may be "HH:mm" or "HH:mm:ss".
 */
export function saInstant(dateStr: string, time: string): Date {
  const t = time.length === 5 ? `${time}:00` : time;
  return fromZonedTime(`${dateStr}T${t}`, TIMEZONE);
}

/** The instant a SAST calendar day begins (00:00:00 SAST). */
export function saDayStart(dateStr: string): Date {
  return saInstant(dateStr, "00:00:00");
}

/**
 * The instant a SAST calendar day ends (23:59:59 SAST).
 *
 * Note this is *inclusive* and second-granular: it excludes the final 999ms of
 * the day. Safe as the upper bound of a Graph calendar window (nothing is
 * scheduled at 23:59:59.5), but for a Prisma range over a real timestamp column
 * prefer `gte: saDayStart(d), lt: saDayStart(nextDay)` so nothing can slip
 * through the gap.
 */
export function saDayEnd(dateStr: string): Date {
  return saInstant(dateStr, "23:59:59");
}

/**
 * A calendar-date string → UTC midnight. Use for `@db.Date` columns and any
 * date-only comparison, so the stored value is a day rather than a moment.
 */
export function calendarDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/**
 * Shift a SAST calendar date by whole days. Pure string→string, so it can't
 * drift: the arithmetic happens on a UTC-midnight anchor.
 *
 * Use `saDayStart(addSaDays(end, 1))` as the *exclusive* upper bound of a range
 * over a real timestamp column — see the caveat on `saDayEnd`.
 */
export function addSaDays(dateStr: string, days: number): string {
  const d = calendarDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The instant a SAST calendar month begins. `month` is 1-based and may overflow
 * or underflow, so callers can write `saMonthStart(y, m + 1)` for the exclusive
 * upper bound of month `m` without special-casing December, or `m - 1` for the
 * previous month without special-casing January.
 */
export function saMonthStart(year: number, month: number): Date {
  const y = year + Math.floor((month - 1) / 12);
  const m = (((month - 1) % 12) + 12) % 12 + 1;
  return saDayStart(`${y}-${String(m).padStart(2, "0")}-01`);
}

/**
 * Do two instants fall on the same SAST calendar day?
 * (Deliberately NOT `getDate()` — those are local-time getters, which mean UTC on
 * the server but SAST on a dev machine.)
 */
export function isSameSaDay(a: Date, b: Date): boolean {
  return saDateStr(a) === saDateStr(b);
}

/** The real instant a booking starts, from its calendar date + SAST start time. */
export function bookingStartsAt(booking: {
  date: Date | string;
  startTime: string;
}): Date {
  return saInstant(saDateStr(booking.date), booking.startTime);
}
