/**
 * Shared TypeScript interfaces for the billing / invoicing system.
 * Used across lib/billing.ts, lib/create-invoice.ts, and admin UI.
 */

import { z } from "zod";

export interface InvoiceLineItem {
  description: string;
  subLine?: string;
  quantity: number;
  unitPriceCents: number;
  /**
   * The discount on this line, in cents.
   *
   * WHOLE-LINE, not per-unit. Booking-derived items have always meant it that
   * way (their quantity is always 1, so it never showed), while the two manual
   * entry paths multiplied it by quantity — the same field name carrying two
   * meanings depending on which screen the admin used. The manual paths now
   * agree with the rest; the input they collect is per-line.
   */
  discountCents: number;
  discountPercent: number;
  totalCents: number;
  bookingId?: string;
  productId?: string;
  courseId?: string;
  orderId?: string;
  attendeeName?: string;
  billingNote?: string;
}

/**
 * The shape as it must be WRITTEN.
 *
 * `lineItems` is a Json column, so nothing but this stands between a malformed
 * object and a stored invoice. It matters because the values are not re-derived
 * anywhere downstream: the PDF prints `totalCents` verbatim and the portal
 * renders `description` straight out of the column, so a bad row is a wrong
 * invoice in a client's hands, discovered weeks later.
 *
 * Zod rejects NaN and Infinity for `z.number()` by default, which is most of
 * what a broken calculation produces.
 */
const invoiceLineItemSchema = z.object({
  description: z.string().min(1, "a line item needs a description"),
  subLine: z.string().optional(),
  quantity: z.number().positive("quantity must be greater than zero"),
  unitPriceCents: z.number().int(),
  discountCents: z.number().int().min(0),
  discountPercent: z.number().min(0).max(100),
  // Never negative: a discount bigger than the line is a mistake, and this
  // number is printed on the document exactly as stored.
  totalCents: z.number().int().min(0, "a line total cannot be negative"),
  bookingId: z.string().optional(),
  productId: z.string().optional(),
  courseId: z.string().optional(),
  orderId: z.string().optional(),
  attendeeName: z.string().optional(),
  billingNote: z.string().optional(),
});

const invoiceLineItemsSchema = z.array(invoiceLineItemSchema);

/**
 * Validate line items on the way IN. Throws — the caller's try/catch turns it
 * into a refusal the admin can read, and refusing to create the row is the only
 * moment this is still cheap to fix.
 */
export function parseLineItems(items: unknown, context: string): InvoiceLineItem[] {
  const result = invoiceLineItemsSchema.safeParse(items);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(
      `${context}: line item ${first?.path.join(".") || "?"} — ${first?.message || "invalid"}`,
    );
  }
  return result.data;
}

/**
 * Read line items back OUT, leniently.
 *
 * Deliberately never throws. These rows predate any validation, and a strict
 * parse on the read path would turn one bad historical row into a permanently
 * broken invoice page and a PDF that cannot be generated — worse than the
 * problem, because it takes away the view you would use to diagnose it.
 *
 * A row that cannot be understood renders as a visible placeholder instead of
 * crashing the document, so the failure is legible rather than silent.
 */
export function readLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((entry): InvoiceLineItem => {
    const parsed = invoiceLineItemSchema.safeParse(entry);
    if (parsed.success) return parsed.data;

    const partial = (entry ?? {}) as Record<string, unknown>;
    const num = (v: unknown, fallback: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fallback;

    return {
      description:
        typeof partial.description === "string" && partial.description.length > 0
          ? partial.description
          : "Line item (details unreadable)",
      subLine: typeof partial.subLine === "string" ? partial.subLine : undefined,
      quantity: num(partial.quantity, 1),
      unitPriceCents: num(partial.unitPriceCents, num(partial.totalCents, 0)),
      discountCents: num(partial.discountCents, 0),
      discountPercent: num(partial.discountPercent, 0),
      totalCents: num(partial.totalCents, 0),
    };
  });
}
