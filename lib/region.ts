// ============================================================
// Multi-Region Types & Helpers
// ============================================================

export type Region = "za" | "int";
export type Currency = "ZAR" | "USD" | "EUR" | "GBP";

export const LT_REGION_COOKIE = "lt-region";
export const LT_CURRENCY_COOKIE = "lt-currency";

export const CURRENCY_CONFIG: Record<
  Currency,
  { symbol: string; locale: string; label: string }
> = {
  ZAR: { symbol: "R", locale: "en-ZA", label: "ZAR" },
  USD: { symbol: "$", locale: "en-US", label: "USD" },
  EUR: { symbol: "€", locale: "en-IE", label: "EUR" },
  GBP: { symbol: "£", locale: "en-GB", label: "GBP" },
};

export const REGION_CONFIG: Record<
  Region,
  { defaultCurrency: Currency; currencies: Currency[]; domain: string }
> = {
  za: {
    defaultCurrency: "ZAR",
    currencies: ["ZAR"],
    domain: "life-therapy.co.za",
  },
  int: {
    defaultCurrency: "USD",
    currencies: ["USD", "EUR", "GBP"],
    domain: "life-therapy.online",
  },
};

/** Detect region from hostname (domain-based, not IP). */
export function getRegionFromHostname(hostname: string): Region {
  if (hostname.includes("life-therapy.co.za")) return "za";
  // Everything else (life-therapy.online, localhost, preview URLs) → international
  // For local dev, override with NEXT_PUBLIC_FORCE_REGION env var
  return "int";
}

export function isInternational(region: Region): boolean {
  return region !== "za";
}

export function isValidCurrency(value: string): value is Currency {
  return ["ZAR", "USD", "EUR", "GBP"].includes(value);
}

export function getBaseUrlForRegion(region: Region): string {
  if (region === "za") return "https://life-therapy.co.za";
  return "https://life-therapy.online";
}
