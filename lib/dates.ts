/**
 * lib/dates.ts — the single place that knows about the business timezone.
 *
 * @kit dates v2 — tracked. Edit it in dev-standards and re-adopt; a local change
 * here is a fork, and `check-kit-drift.mjs` will say so.
 *
 * Two rules, and every bug in this area comes from confusing them:
 *
 *   A **calendar date** ("2026-07-08") is a day, not a moment. Build it at UTC
 *   midnight so date-only columns round-trip cleanly — `calendarDate()`.
 *
 *   A **real instant** (`createdAt`, `paidAt`, `new Date()`) is a moment, not a
 *   day. You must resolve it through the timezone before you can call it a day —
 *   `saDateStr()`. Slicing its ISO string gives you the *UTC* day, which is wrong
 *   for two hours every night (22:00–24:00 UTC is already tomorrow in SAST).
 *
 * Never hardcode an offset like "+02:00" — go through TIMEZONE, so there is
 * exactly one thing to change if the business ever moves or a zone gains DST.
 *
 * **This module fails closed.** Every entry point validates its input and throws
 * rather than returning an `Invalid Date`, because an `Invalid Date` compares
 * `false` against everything in both directions: a query range built from one
 * silently matches nothing, which reads as "no results" rather than as an error.
 * If your input is untrusted (a query param, a CSV import), guard it with
 * `isSaDateStr()` first and fall back — don't let the exception reach the user.
 *
 * ── WHY THIS IS IN THE KIT ──────────────────────────────────────────────────
 *
 * It was written for life-therapy, and yoros needs the same distinctions for
 * booking and for the intake scheduler. Two implementations of this would drift,
 * and the drift would be invisible: both would look correct in isolation and
 * disagree by one day for two hours a night. So there is one source, and
 * `check-kit-drift.mjs` fails when a project edits its copy.
 *
 * The `sa` prefix and TIMEZONE's VALUE are the parts a project owns — the value
 * is in a KIT:CONFIG region below. A project outside South Africa keeps the
 * logic and changes that region; it does not get its own module.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/* KIT:CONFIG timezone — the business timezone. One value, and every helper
   below resolves through it. A project sets this once and never again. */
/** The business timezone. This module owns it; other modules import from here. */
export const TIMEZONE = "Africa/Johannesburg";
/* KIT:CONFIG /timezone */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** An ISO datetime that states its offset — "…Z", "…+02:00", "…-0500". */
const ZONED_ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})$/;
const TIME_OF_DAY = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

const MS_PER_DAY = 86_400_000;

function assertRealDate(d: Date, fn: string, raw: unknown): Date {
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`${fn}: ${JSON.stringify(raw)} is not a real date.`);
  }
  return d;
}

function assertInteger(n: number, fn: string, name: string): number {
  if (!Number.isInteger(n)) {
    throw new TypeError(`${fn}: ${name} must be a whole number, got ${n}.`);
  }
  return n;
}

/**
 * Does this string name a day that actually exists?
 *
 * A NaN check is NOT enough. V8 silently *rolls over* an out-of-range day inside
 * a valid month: `new Date("2025-02-29T00:00:00Z")` is 1 March, not Invalid Date.
 * So we round-trip the parse and require it to reproduce the input exactly —
 * otherwise a typo'd or imported date lands one day off, forever, in silence.
 */
function isRealCalendarDay(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false; // month 0/13, day 32
  return carrierDateStr(d) === dateStr; // Feb 30 -> "03-02", rejected
}

/**
 * A UTC-midnight carrier as "YYYY-MM-DD", read from its UTC fields.
 *
 * NOT `toISOString().slice(0, 10)`. That gives the same string here and the wrong
 * one on a real instant, and no linter can tell the two uses apart. pleks's
 * `no-adhoc-dates` flags every one, because the idiom has shipped a legal-date bug
 * there. Spelling out the UTC fields says which kind of Date this is (v2).
 */
function carrierDateStr(d: Date): string {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Is this a well-formed calendar date — "YYYY-MM-DD", and a day that actually
 * exists? Use at untrusted boundaries before calling anything below.
 */
export function isSaDateStr(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return false;
  return isRealCalendarDay(value);
}

function assertSaDateStr(dateStr: string, fn: string): string {
  if (!DATE_ONLY.test(dateStr)) {
    throw new TypeError(
      `${fn}: expected a "YYYY-MM-DD" calendar date, got ${JSON.stringify(dateStr)}.`,
    );
  }
  if (!isRealCalendarDay(dateStr)) {
    throw new RangeError(`${fn}: ${JSON.stringify(dateStr)} is not a real date.`);
  }
  return dateStr;
}

/**
 * Resolve a value to a real instant.
 *
 * A zone-less datetime string ("2026-07-08T23:30") is REJECTED: JS parses it in
 * the *server's* timezone, so it names a different moment in production than on
 * a dev machine — the precise failure this module exists to prevent. Pass a
 * Date, a "YYYY-MM-DD" calendar date, or an ISO string carrying its offset.
 */
function toInstant(value: Date | string, fn: string): Date {
  if (value instanceof Date) return assertRealDate(value, fn, value.toString());
  if (DATE_ONLY.test(value)) return calendarDate(value);
  if (ZONED_ISO.test(value)) return assertRealDate(new Date(value), fn, value);
  throw new TypeError(
    `${fn}: ${JSON.stringify(value)} has no timezone. Pass a Date, "YYYY-MM-DD", ` +
      `or an ISO string ending in Z or ±HH:MM — a zone-less datetime resolves ` +
      `differently on the server than in dev.`,
  );
}

/**
 * Format an instant in the business timezone. The generic escape hatch — reach
 * for the named helpers below first, and use this only for patterns they don't
 * cover. Never `format()` a Date for display: that renders in the *server's*
 * timezone.
 *
 * Takes a Date, not a string, on purpose. `saFormat("2026-07-08", "HH:mm")`
 * would return "02:00" — the UTC-midnight carrier seen from SAST — which is an
 * artefact, never an answer. Resolve a calendar date with `calendarDate()` first
 * if you really mean that instant.
 */
export function saFormat(date: Date, pattern: string): string {
  assertRealDate(date, "saFormat", date?.toString?.());
  return formatInTimeZone(date, TIMEZONE, pattern);
}

/** A real instant → the calendar day it falls on locally, as "yyyy-MM-dd". */
export function saDateStr(date: Date | string): string {
  return formatInTimeZone(toInstant(date, "saDateStr"), TIMEZONE, "yyyy-MM-dd");
}

/** Today's local calendar day, as "yyyy-MM-dd". */
export function saToday(): string {
  return saDateStr(new Date());
}

/**
 * A local wall-clock date + time → the real instant it refers to.
 * `time` is "H:mm", "HH:mm" or "HH:mm:ss"; "24:00" and "9:60" throw.
 */
export function saInstant(dateStr: string, time: string): Date {
  assertSaDateStr(dateStr, "saInstant");
  const parts = TIME_OF_DAY.exec(time);
  if (!parts) {
    throw new TypeError(
      `saInstant: ${JSON.stringify(time)} is not a time of day (expected "HH:mm" or "HH:mm:ss").`,
    );
  }
  const [h, m, s] = [Number(parts[1]), Number(parts[2]), Number(parts[3] ?? 0)];
  if (h > 23 || m > 59 || s > 59) {
    throw new RangeError(`saInstant: ${JSON.stringify(time)} is not a time of day.`);
  }
  const hhmmss = [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
  return assertRealDate(
    fromZonedTime(`${dateStr}T${hhmmss}`, TIMEZONE),
    "saInstant",
    `${dateStr}T${time}`,
  );
}

/** The instant a local calendar day begins (00:00:00 local). */
export function saDayStart(dateStr: string): Date {
  return saInstant(dateStr, "00:00:00");
}

/**
 * The instant a local calendar day ends (23:59:59 local).
 *
 * Note this is *inclusive* and second-granular: it excludes the final 999ms of
 * the day. Safe as the upper bound of a calendar window (nothing is scheduled at
 * 23:59:59.5), but for a range query over a real timestamp column prefer
 * `gte: saDayStart(d), lt: saDayStart(addSaDays(d, 1))` so nothing slips through
 * the gap.
 */
export function saDayEnd(dateStr: string): Date {
  return saInstant(dateStr, "23:59:59");
}

/**
 * A calendar-date string → UTC midnight. Use for date-only columns and any
 * date-only comparison, so the stored value is a day rather than a moment.
 */
export function calendarDate(dateStr: string): Date {
  assertSaDateStr(dateStr, "calendarDate");
  return new Date(`${dateStr}T00:00:00Z`);
}

/**
 * Shift a calendar date by whole days. Pure string→string, so it can't drift:
 * the arithmetic happens on a UTC-midnight anchor.
 *
 * Use `saDayStart(addSaDays(end, 1))` as the *exclusive* upper bound of a range
 * over a real timestamp column — see the caveat on `saDayEnd`.
 */
export function addSaDays(dateStr: string, days: number): string {
  assertInteger(days, "addSaDays", "days");
  const d = calendarDate(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return carrierDateStr(d);
}

/**
 * Whole calendar days from `from` to `to` (negative if `to` is earlier).
 *
 * Not the same as dividing a millisecond difference by 86.4M: that answers "how
 * many 24-hour spans", so 23:00 Monday → 08:00 Tuesday floors to 0 days when the
 * calendar says 1. Reach for this whenever a threshold is phrased in days
 * ("30 days since the last session"), rather than hand-rolling the division.
 */
export function diffSaDays(from: Date | string, to: Date | string): number {
  const a = calendarDate(saDateStr(from)).getTime();
  const b = calendarDate(saDateStr(to)).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * The instant a local calendar month begins. `month` is 1-based and may overflow
 * or underflow, so callers can write `saMonthStart(y, m + 1)` for the exclusive
 * upper bound of month `m` without special-casing December, or `m - 1` for the
 * previous month without special-casing January.
 */
export function saMonthStart(year: number, month: number): Date {
  assertInteger(year, "saMonthStart", "year");
  assertInteger(month, "saMonthStart", "month");
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  return saDayStart(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`);
}

/**
 * Do two instants fall on the same local calendar day?
 * (Deliberately NOT `getDate()` — those are local-time getters, which mean UTC on
 * the server but the business zone on a dev machine.)
 */
export function isSameSaDay(a: Date | string, b: Date | string): boolean {
  return saDateStr(a) === saDateStr(b);
}

/* KIT:CONFIG domain — helpers over the PROJECT'S OWN shapes.
   Canon owns the calendar arithmetic above; it has no opinion about what a
   booking or an article looks like. Anything here reads a project type and
   delegates upward — never new date logic, which belongs in canon where the
   tests can see it. A project with no such shapes leaves this region empty. */
/** The real instant a booking starts, from its calendar date + SAST start time.
 *  Reads a booking shape and delegates to `saInstant` — no date logic of its own,
 *  which is the whole rule for this region. */
export function bookingStartsAt(booking: {
  date: Date | string;
  startTime: string;
}): Date {
  return saInstant(saDateStr(booking.date), booking.startTime);
}
/* KIT:CONFIG /domain */
