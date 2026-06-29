/**
 * lib/phone.ts — single source of truth for phone-number validation, normalisation
 * and formatting across Life-Therapy (client forms, booking forms, CSV-ish entry,
 * WhatsApp sends).
 *
 * Pure + dependency-light (safe on client and server, easy to unit-test). Format-only:
 * it checks shape, not deliverability. Ported from the Pleks number normaliser.
 *
 * SA numbers are validated by our own strict regex (exactly 10 significant digits), so
 * they never rely on libphonenumber. Foreign numbers are validated against libphonenumber's
 * default ("min") metadata — a length/prefix check, which is plenty for our use and keeps
 * the client bundle small (the heavier "/max" full-pattern metadata isn't worth it here,
 * and its subpath also trips up the tsx loader used by our backfill script).
 */
import { parsePhoneNumberFromString } from "libphonenumber-js";

export type PhoneKind = "sa" | "foreign" | "invalid";

export interface PhoneCheck {
  valid: boolean;
  kind: PhoneKind;
  reason?: string;
  /** Canonical E.164, e.g. "+27821234567" — present only when valid. */
  e164?: string;
  /** ISO country code, e.g. "ZA", "GB" — present only when valid. */
  country?: string;
}

/**
 * Classify + validate a phone number. South African numbers are checked STRICTLY against
 * our own rule (exactly 10 significant digits — local 0XXXXXXXXX, or +27 / 0027 then 9
 * digits), which is tighter than libphonenumber's length leniency. Anything dialling out
 * with a different country code is FOREIGN and validated against that country's real
 * numbering plan via libphonenumber-js. A bare number with no 0 / + prefix is rejected.
 */
export function checkPhone(raw: string | null | undefined): PhoneCheck {
  const v = (raw ?? "").trim();
  if (!v) return { valid: false, kind: "invalid", reason: "Required" };

  const compact = v.replace(/[\s()\-.]/g, "");
  if (/[^\d+]/.test(compact) || (compact.includes("+") && !compact.startsWith("+"))) {
    return { valid: false, kind: "invalid", reason: "Use digits only, with a leading + for international." };
  }

  // SA forms: a leading 0 (but not 00), or the +27 / 0027 international prefixes.
  if (/^0(?!0)/.test(compact) || compact.startsWith("+27") || compact.startsWith("0027")) {
    const okSA = /^0\d{9}$/.test(compact) || /^\+27\d{9}$/.test(compact) || /^0027\d{9}$/.test(compact);
    if (!okSA) {
      return { valid: false, kind: "sa", reason: "A South African number is 10 digits (e.g. 082 123 4567)." };
    }
    return { valid: true, kind: "sa", e164: `+27${compact.replace(/\D/g, "").slice(-9)}`, country: "ZA" };
  }

  // Foreign: the 00 international prefix becomes +, then validate against the country's plan.
  const intl = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const parsed = intl.startsWith("+") ? parsePhoneNumberFromString(intl) : undefined;
  if (parsed?.isValid()) return { valid: true, kind: "foreign", e164: parsed.number, country: parsed.country };

  return {
    valid: false,
    kind: "invalid",
    reason: "Enter a valid phone number — 10 digits for SA, or +<country code> for international.",
  };
}

/** True when the number is a valid SA or foreign number. */
export function isValidPhone(raw: string | null | undefined): boolean {
  return checkPhone(raw).valid;
}

/** Error string for a phone field, or null when valid. `required` controls whether empty is an error. */
export function phoneError(raw: string | null | undefined, required = true): string | null {
  const v = (raw ?? "").trim();
  if (!v) return required ? "Required" : null;
  return checkPhone(v).reason ?? null;
}

/** Normalise to a canonical E.164 string for STORAGE (e.g. +27821234567) — or null if invalid. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const c = checkPhone(raw);
  return c.valid ? (c.e164 ?? null) : null;
}

/**
 * Lenient storage normaliser: E.164 when the number is valid, otherwise the input
 * as-typed (trimmed). Empty → null. Use at write sites so good numbers are stored
 * canonically without rejecting messy legacy/import data.
 */
export function normalizePhoneForStorage(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  return normalizePhone(v) ?? v;
}

/**
 * Format for DISPLAY — uniform, grouped per the number's own country: "+27 82 123 4567",
 * "+44 20 7946 0958". An unparseable value is returned trimmed (never throws), so it's
 * safe to wrap any stored/typed string.
 */
export function formatPhone(raw: string | null | undefined): string {
  const c = checkPhone(raw);
  if (!c.valid || !c.e164) return (raw ?? "").trim();
  const parsed = parsePhoneNumberFromString(c.e164);
  return parsed ? parsed.formatInternational() : c.e164;
}

/** The full international number as digits only, no "+" — what WhatsApp / wa.me links expect (e.g. 27821234567). */
export function phoneToWhatsApp(raw: string | null | undefined): string | null {
  const e164 = normalizePhone(raw);
  return e164 ? e164.replace(/\D/g, "") : null;
}
