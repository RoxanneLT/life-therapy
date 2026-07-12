import { saFormat, calendarDate } from "@/lib/dates";
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
 * Render a set of per-currency amounts as ONE display string, e.g.
 * `"R12 400,00 + $560.00"`.
 *
 * Money in different currencies cannot be added. Any total that spans currencies
 * must stay split — a dashboard tile that sums USD cents into a Rand figure is
 * not a rounding error, it is a fabricated number. Feed this from a Prisma
 * `groupBy(["currency"])`, never from a bare `_sum`.
 *
 * ZAR sorts first (it is the primary book); zero-value currencies are dropped so
 * a dormant currency doesn't clutter the tile. An empty set renders as R0,00.
 */
export function formatByCurrency(
  amounts: { currency: string; cents: number }[],
): string {
  const nonZero = amounts.filter((a) => a.cents !== 0);
  if (nonZero.length === 0) return formatPrice(0, "ZAR");
  const ordered = nonZero.toSorted((a, b) => {
    if (a.currency === b.currency) return 0;
    if (a.currency === "ZAR") return -1;
    if (b.currency === "ZAR") return 1;
    return a.currency.localeCompare(b.currency);
  });
  return ordered.map((a) => formatPrice(a.cents, a.currency)).join(" + ");
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
  // Format the label off a UTC-midnight anchor, not a local-midnight one. The old
  // form only rendered the right month because it built and formatted in the same
  // (server-local) timezone — correct by luck, not by construction.
  const label = m ? saFormat(calendarDate(`${m[1]}-${m[2]}-01`), "MMM yyyy") : key;
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
