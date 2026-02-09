// ============================================================
// Server-side region/currency readers (for server components + API routes)
// Reads from cookies set by middleware.
// ============================================================

import { cookies } from "next/headers";
import {
  type Region,
  type Currency,
  LT_REGION_COOKIE,
  LT_CURRENCY_COOKIE,
  REGION_CONFIG,
  isValidCurrency,
  getBaseUrlForRegion,
} from "./region";

/** Read current region from cookie. Defaults to "za". */
export function getRegion(): Region {
  const cookieStore = cookies();
  const value = cookieStore.get(LT_REGION_COOKIE)?.value;
  if (value === "int") return "int";
  return "za";
}

/** Read current currency from cookie. Defaults per region. */
export function getCurrency(): Currency {
  const cookieStore = cookies();
  const region = getRegion();
  const value = cookieStore.get(LT_CURRENCY_COOKIE)?.value;
  if (value && isValidCurrency(value)) return value;
  return REGION_CONFIG[region].defaultCurrency;
}

/** Get the base URL for the current region. */
export function getBaseUrl(): string {
  return getBaseUrlForRegion(getRegion());
}
