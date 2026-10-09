import { prisma } from "@/lib/prisma";

/**
 * What services outside this database still hold about a client, for the manual half of an
 * erasure. eraseClient anonymises our rows, but it cannot reach Paystack, Resend, Microsoft or
 * Meta. Paystack exposes no API we use to delete a customer, and we store no Resend message id,
 * so the admin finishes the job by hand. This lists what to look for.
 *
 * Every count reads rows erasure keeps (invoices, payment requests, orders, bookings and the
 * anonymised send logs keep their studentId), so it answers the same after the erase as before.
 */
export interface ExternalHolders {
  /** Paystack transaction references, which find the customer in the Paystack dashboard. */
  paystackReferences: string[];
  /** Outlook/Teams events created for their sessions, which still name them as an attendee. */
  calendarEvents: number;
  /** Emails sent through Resend, which keeps its own log of each one. */
  emailsSent: number;
  /** WhatsApp messages sent through Meta's API. */
  whatsappMessages: number;
}

export async function externalHolders(studentId: string): Promise<ExternalHolders> {
  const [orders, invoices, paymentRequests, events, emailsSent, whatsappMessages] = await Promise.all([
    prisma.order.findMany({ where: { studentId, paystackReference: { not: null } }, select: { paystackReference: true } }),
    prisma.invoice.findMany({ where: { studentId, paystackReference: { not: null } }, select: { paystackReference: true } }),
    prisma.paymentRequest.findMany({ where: { studentId, paystackReference: { not: null } }, select: { paystackReference: true } }),
    // A recurring series shares one event, so the count is of distinct ids.
    prisma.booking.findMany({ where: { studentId, graphEventId: { not: null } }, select: { graphEventId: true }, distinct: ["graphEventId"] }),
    prisma.emailLog.count({ where: { studentId, status: "sent" } }),
    prisma.whatsAppLog.count({ where: { studentId } }),
  ]);
  const paystackReferences = [
    ...new Set([...orders, ...invoices, ...paymentRequests].map((r) => r.paystackReference).filter((r): r is string => !!r)),
  ].sort((a, b) => a.localeCompare(b));
  return { paystackReferences, calendarEvents: events.length, emailsSent, whatsappMessages };
}
