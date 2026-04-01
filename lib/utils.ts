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
