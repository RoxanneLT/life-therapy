// ============================================================
// Multi-Region Types & Helpers
// ============================================================

export type Region = "za" | "int";

/** The runtime source of truth for the Currency union — derive, never duplicate.
 *  A DB column is a plain String, so any value read from one must be validated
 *  against THIS list (see `toCurrency` in lib/billing.ts) rather than cast. */
export const CURRENCIES = ["ZAR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LT_REGION_COOKIE = "lt-region";
export const LT_CURRENCY_COOKIE = "lt-currency";

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

/**
 * Is this hostname one of ours?
 *
 * ONE definition, deliberately, because two sides of the same rule read it and
 * they must never disagree. The click redirector (`app/api/track/click`) refuses
 * to forward anywhere else; `injectTracking` in lib/email.ts must therefore not
 * WRAP anything else. When only the redirector learned the rule, every external
 * link in every email — the Teams "Join your session" link above all — became a
 * tracked URL the redirector then rejected, and the client got a page of JSON
 * reading `{"error":"Untrusted URL"}` instead of their session (§6, 2026-08-19).
 *
 * `localhost` is included outside production so tracked links work in dev.
 */
export function isOurHost(hostname: string): boolean {
  const ours = Object.values(REGION_CONFIG).map((r) => r.domain);
  const hosts =
    process.env.NODE_ENV === "production" ? ours : [...ours, "localhost"];
  return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
}

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

/**
 * The base URL for a context that knows NEITHER the request host NOR the
 * recipient — a system job with no better signal (the sendEmail choke point, a
 * bulk campaign iterating over mixed regions).
 *
 * Folds the two env vars that were read interchangeably (NEXT_PUBLIC_APP_URL and
 * NEXT_PUBLIC_BASE_URL) into ONE resolver, and replaces ~20 copies of the literal
 * `process.env.X || "https://life-therapy.co.za"`. Prefer `getBaseUrl()` (request
 * context) or `getBaseUrlForCurrency(currency)` (you have the recipient) — reach
 * for this only when you genuinely have neither.
 *
 * NOTE: not yet region-aware — it returns the configured URL (currently .co.za),
 * so it is the one remaining place an international recipient can get a .co.za
 * link. Made region-aware here, once, when a per-region signal is available.
 */
export function appBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  return (env || "https://life-therapy.co.za").replace(/\/$/, "");
}

/** The region a client belongs to, from the currency their sessions are priced in. */
export function regionForCurrency(currency: string | null | undefined): Region {
  return currency === "ZAR" || !currency ? "za" : "int";
}

/**
 * Base URL for a specific RECIPIENT, keyed off their currency.
 *
 * Use this in emails/PDFs sent from a context with no request (cron, webhooks,
 * admin actions operating on someone else's record) — there is no host or cookie
 * to read, so `getBaseUrl()` can't help, and hardcoding ".co.za" sends an
 * international client to the wrong site. A ZAR client gets .co.za, everyone else
 * .online.
 */
export function getBaseUrlForCurrency(currency: string | null | undefined): string {
  return getBaseUrlForRegion(regionForCurrency(currency));
}

export function getBaseUrlForRegion(region: Region): string {
  // Production serves BOTH domains from one deployment, and the region is decided
  // per-request from the hostname. So in production the URL MUST follow the region
  // — a hardcoded NEXT_PUBLIC_APP_URL would send every international client's email
  // and PDF links to .co.za, silently, because there is only one env scope for the
  // two domains.
  //
  // The env override is therefore for NON-production only: local dev and preview
  // deployments, which have no real hostname to key off. There, an unset value
  // falls through to the region default, which is fine.
  if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  return region === "za" ? "https://life-therapy.co.za" : "https://life-therapy.online";
}
