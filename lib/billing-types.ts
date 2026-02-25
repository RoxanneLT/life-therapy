/**
 * Shared TypeScript interfaces for the billing / invoicing system.
 * Used across lib/billing.ts, lib/create-invoice.ts, and admin UI.
 */

export interface InvoiceLineItem {
  description: string;
  subLine?: string;
  quantity: number;
  unitPriceCents: number;
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
