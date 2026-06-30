import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CURRENCY_LOCALES: Record<string, string> = {
  ZAR: "en-ZA",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
};

export function formatPrice(cents: number, currency = "ZAR"): string {
  const locale = CURRENCY_LOCALES[currency] || "en-ZA";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Turn a stored billingMonth key into a clean display label + an optional type
 * badge. The key is an internal unique value, not meant to be shown raw:
 *   "2026-06"                    → { label: "Jun 2026", badge: null }      (monthly run)
 *   "2026-06-USD"                → { label: "Jun 2026", badge: null }      (monthly, foreign)
 *   "2026-06-adhoc-1" / legacy   → { label: "Jun 2026", badge: "Ad-hoc" } (Bill-to-Date)
 *   "2026-06-manual-2"           → { label: "Jun 2026", badge: "Manual" } (manual invoice)
 */
export function formatBillingMonth(
  key: string | null | undefined,
): { label: string; badge: string | null } {
  if (!key) return { label: "—", badge: null };
  const m = /^(\d{4})-(\d{2})/.exec(key);
  const label = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString("en-ZA", {
        month: "short",
        year: "numeric",
      })
    : key;
  let badge: string | null = null;
  if (key.includes("-adhoc")) badge = "Ad-hoc";
  else if (key.includes("-manual")) badge = "Manual";
  return { label, badge };
}

/** Escape HTML special characters to prevent XSS in email templates. */
export function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_]+/g, "-")
    .replaceAll(/(?:^-+)|(?:-+$)/g, "");
}

/**
 * Format a phone number for display in international format.
 * "+27764106679"  → "+27 76 410 6679"
 * "+447911123456" → "+44 7911 123456"
 * Falls back to the raw value if the number can't be parsed.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  try {
    const parsed = parsePhoneNumberFromString(phone);
    if (parsed?.isValid()) return parsed.formatInternational();
  } catch {
    // fall through
  }
  return phone;
}
