// ============================================================
// Multi-Currency Pricing Helpers
// Reads prices from DB records based on selected currency.
// Falls back to ZAR price if international price is not set.
// ============================================================

import type { Currency } from "./region";

/**
 * Get course price in the given currency.
 * Falls back to ZAR (price) if the international column is null.
 */
export function getCoursePrice(
  course: { price: number; priceUsd?: number | null; priceEur?: number | null; priceGbp?: number | null },
  currency: Currency
): number {
  switch (currency) {
    case "USD": return course.priceUsd ?? course.price;
    case "EUR": return course.priceEur ?? course.price;
    case "GBP": return course.priceGbp ?? course.price;
    default:    return course.price;
  }
}

/**
 * Get standalone module price in the given currency.
 */
export function getModulePrice(
  module: {
    standalonePrice?: number | null;
    standalonePriceUsd?: number | null;
    standalonePriceEur?: number | null;
    standalonePriceGbp?: number | null;
  },
  currency: Currency
): number {
  const zar = module.standalonePrice ?? 0;
  switch (currency) {
    case "USD": return module.standalonePriceUsd ?? zar;
    case "EUR": return module.standalonePriceEur ?? zar;
    case "GBP": return module.standalonePriceGbp ?? zar;
    default:    return zar;
  }
}

/**
 * Get hybrid package price in the given currency.
 */
export function getPackagePrice(
  pkg: {
    priceCents: number;
    priceCentsUsd?: number | null;
    priceCentsEur?: number | null;
    priceCentsGbp?: number | null;
  },
  currency: Currency
): number {
  switch (currency) {
    case "USD": return pkg.priceCentsUsd ?? pkg.priceCents;
    case "EUR": return pkg.priceCentsEur ?? pkg.priceCents;
    case "GBP": return pkg.priceCentsGbp ?? pkg.priceCents;
    default:    return pkg.priceCents;
  }
}

/**
 * Get digital product price in the given currency.
 */
export function getDigitalProductPrice(
  product: {
    priceCents: number;
    priceCentsUsd?: number | null;
    priceCentsEur?: number | null;
    priceCentsGbp?: number | null;
  },
  currency: Currency
): number {
  switch (currency) {
    case "USD": return product.priceCentsUsd ?? product.priceCents;
    case "EUR": return product.priceCentsEur ?? product.priceCents;
    case "GBP": return product.priceCentsGbp ?? product.priceCents;
    default:    return product.priceCents;
  }
}

/**
 * Get session price from SiteSetting for the given type + currency.
 * Returns 0 if the price has not been configured — no hardcoded fallbacks.
 */
export function getSessionPrice(
  sessionType: "individual" | "couples",
  currency: Currency,
  settings?: {
    sessionPriceIndividualZar?: number | null;
    sessionPriceIndividualUsd?: number | null;
    sessionPriceIndividualEur?: number | null;
    sessionPriceIndividualGbp?: number | null;
    sessionPriceCouplesZar?: number | null;
    sessionPriceCouplesUsd?: number | null;
    sessionPriceCouplesEur?: number | null;
    sessionPriceCouplesGbp?: number | null;
  } | null
): number {
  if (!settings) return 0;

  if (sessionType === "individual") {
    switch (currency) {
      case "ZAR": return settings.sessionPriceIndividualZar ?? 0;
      case "USD": return settings.sessionPriceIndividualUsd ?? 0;
      case "EUR": return settings.sessionPriceIndividualEur ?? 0;
      case "GBP": return settings.sessionPriceIndividualGbp ?? 0;
    }
  } else {
    switch (currency) {
      case "ZAR": return settings.sessionPriceCouplesZar ?? 0;
      case "USD": return settings.sessionPriceCouplesUsd ?? 0;
      case "EUR": return settings.sessionPriceCouplesEur ?? 0;
      case "GBP": return settings.sessionPriceCouplesGbp ?? 0;
    }
  }
}
