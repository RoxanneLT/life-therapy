/**
 * Atomic invoice number generation.
 *
 * Format: YYYYMMDD-{PREFIX}-{INITIALS}-{SEQUENCE}
 * Example: 20260220-LT-GS-00001
 *
 * The sequence is global (never resets) and incremented atomically
 * via a Prisma transaction on the InvoiceSequence table.
 */

import { prisma } from "@/lib/prisma";
import { saDateStr } from "@/lib/dates";

/**
 * Extract initials from a name.
 *   "Genna Scott"                → "GS"
 *   "ABC Corp Employee Wellness" → "AC"  (first + last word)
 *   "John"                       → "JO"  (first 2 letters if single word)
 */
export function extractInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "XX";
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Format an invoice number from its parts.
 *   (2026-02-20, "LT", "GS", 1) → "20260220-LT-GS-00001"
 */
export function formatInvoiceNumber(
  date: Date,
  prefix: string,
  initials: string,
  sequence: number,
): string {
  // `date` is a real instant (callers pass `new Date()`), so resolve the SAST
  // calendar day. Local getters read UTC on the server, which would number an
  // invoice raised at 00:30 SAST with the *previous* day — while the invoice
  // body displays the SAST date.
  const ymd = saDateStr(date).replace(/-/g, "");
  const seq = String(sequence).padStart(5, "0");
  return `${ymd}-${prefix}-${initials}-${seq}`;
}

/**
 * Atomically fetch and increment the global invoice sequence, then
 * return the formatted invoice number.
 *
 * Uses a Prisma interactive transaction to guarantee uniqueness even
 * under concurrent requests.
 */
export async function getNextInvoiceNumber(
  billingName: string,
  prefix: string,
  date: Date,
): Promise<{ number: string; sequence: number }> {
  const initials = extractInitials(billingName);

  const result = await prisma.$transaction(async (tx) => {
    // Atomically increment and return the new sequence value
    const updated = await tx.invoiceSequence.update({
      where: { id: "global" },
      data: { nextNumber: { increment: 1 } },
    });
    // The sequence we use is the value *before* increment
    return updated.nextNumber - 1;
  });

  return {
    number: formatInvoiceNumber(date, prefix, initials, result),
    sequence: result,
  };
}
