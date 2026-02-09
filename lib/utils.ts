import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/[^\w\s-]/g, "")
    .replaceAll(/[\s_]+/g, "-")
    .replaceAll(/(?:^-+)|(?:-+$)/g, "");
}
