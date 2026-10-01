import { randomBytes } from "crypto";

/**
 * A Paystack reference for an order: `<orderNumber>-<B|C><16 hex>`.
 *
 * Random, not a timestamp: `LT-<date>-<seq>-<epoch ms>` could be guessed from another order's. And
 * it says which door the order came in by — `B` buy-now, `C` cart — because the buy-now thank-you
 * page serves a download on the reference alone, and only a buy-now reference may do that. A cart
 * reference sits in /checkout/success's URL, which analytics records; without the marker, making
 * cart references random would have made that URL a credential.
 */
export type OrderChannel = "cart" | "buy-now";

export const BUY_NOW_REFERENCE = /^LT-\d{8}-\d{4,}-B[0-9a-f]{16}$/;

export function orderReference(orderNumber: string, channel: OrderChannel, random = randomBytes(8)): string {
  return `${orderNumber}-${channel === "buy-now" ? "B" : "C"}${random.toString("hex")}`;
}
