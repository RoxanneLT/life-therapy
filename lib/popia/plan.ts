/**
 * What a POPIA erasure does to every client-linked column. The register, not the executor:
 * lib/popia/erase-client.ts does the work, and the audit (`popia: every client-linked column has
 * a fate`) fails when a model carrying a studentId gains a text column this file does not name.
 * Shape from Pleks's lib/popia/anonymisePlan.ts — "complete by construction is the whole point".
 *
 * The owner's rulings, 2026-10-09:
 *   - anonymise in place, never delete the client: the credit ledger cascades from Student, and
 *     invoices, orders and payment requests are tax records SARS requires for five years;
 *   - CLINICAL content (intake answers, session and admin notes) is kept, encrypted and attached
 *     only to the anonymous record, until Student.retainUntil — five years after the last session,
 *     as the privacy policy (§6) promises — then purged by lib/popia/purge-retained.ts;
 *   - the erased client's name and email are stripped from OTHER clients' couples bookings too;
 *   - only a super admin starts one, on the client's request, with a fresh 2FA code.
 *
 * Fates:
 *   erase     blanked (null, or a placeholder where the column is required) at erasure
 *   clinical  kept until retainUntil, then blanked by the purge
 *   partner   this client's identity as it appears on ANOTHER client's booking; blanked there
 *   keep      untouched, with the reason
 * A whole model can carry one fate instead: "delete" (rows removed at erasure) or "keep: …".
 */

import type { Prisma } from "@/lib/generated/prisma/client";

export type Fate = "erase" | "clinical" | "partner" | `keep: ${string}`;
export type ModelFate = "delete" | `keep: ${string}`;

export const ERASED_FIRST_NAME = "Erased";
export const ERASED_LAST_NAME = "client";
export const ERASED_TEXT = "[erased]";

/** Unique (Student.email is) and undeliverable, on the domain minors' placeholders already use. */
export function erasedEmail(studentId: string): string {
  return `erased-${studentId}@noemail.internal`;
}

export const COLUMN_FATES: Record<string, Record<string, Fate>> = {
  student: {
    email: "erase",
    firstName: "erase",
    lastName: "erase",
    avatarUrl: "erase",
    dateOfBirth: "erase",
    gender: "erase",
    phone: "erase",
    address: "erase",
    relationshipStatus: "erase",
    emergencyContact: "erase",
    referralSource: "erase",
    referralDetail: "erase",
    tags: "erase",
    billingEmail: "erase",
    billingAddress: "erase",
    emailPauseReason: "erase",
    adminNotes: "clinical",
    unsubscribeToken: "keep: the suppression key; an erased client must never be mailed again",
    branch: "keep: the practice's office, not the client",
    clientStatus: "keep: set to archived, which every list and send already honours",
    convertedBy: "keep: names the admin, not the client",
    erasedBy: "keep: names the admin who erased, the accountability record",
    retainUntil: "keep: drives the purge",
    source: "keep: how the record arrived, not who it is",
    consentMethod: "keep: proof of the lawful basis the data was held on (POPIA s11, s17)",
    billingType: "keep: describes the billing of the retained financial records",
  },
  booking: {
    clientName: "erase",
    clientEmail: "erase",
    clientPhone: "erase",
    teamsMeetingUrl: "erase",
    confirmationToken: "erase",
    clientNotes: "clinical",
    adminNotes: "clinical",
    sessionNotes: "clinical",
    cancellationReason: "clinical",
    couplesPartnerName: "partner",
    couplesPartnerEmail: "partner",
    couplesPartnerPhone: "partner",
    date: "keep: the session record behind an invoice (tax)",
    startTime: "keep: as date",
    endTime: "keep: as date",
    originalDate: "keep: as date",
    originalStartTime: "keep: as date",
    priceCurrency: "keep: the price of a billed session (tax)",
    billingNote: "keep: a billing marker such as (no-show), read by the invoice",
    cancelledBy: "keep: client or admin, not an identity",
    recurringPattern: "keep: scheduling shape",
    reminderSentFor: "keep: a send marker",
    whatsappReminder24hSentFor: "keep: a send marker",
    whatsappReminderMorningSentFor: "keep: a send marker",
  },
  clientIntake: {
    behaviours: "clinical",
    feelings: "clinical",
    symptoms: "clinical",
    otherBehaviours: "clinical",
    otherFeelings: "clinical",
    otherSymptoms: "clinical",
    additionalNotes: "clinical",
    adminNotes: "clinical",
    lastEditedBy: "keep: names the admin, not the client",
  },
  emailLog: {
    to: "erase",
    subject: "erase",
    error: "erase",
    metadata: "erase",
    templateKey: "keep: which email, not to whom",
    status: "keep: sent or failed",
  },
  whatsAppLog: {
    to: "erase",
    error: "erase",
    metadata: "erase",
    templateName: "keep: which message, not to whom",
    status: "keep: sent or failed",
  },
  gift: {
    recipientEmail: "erase",
    recipientName: "erase",
    message: "erase",
    packageSelections: "keep: what was bought (an order line, tax)",
    redeemToken: "keep: unguessable, identifies nobody",
  },
};

export const MODEL_FATES: Record<string, ModelFate> = {
  invoice: "keep: a tax invoice, kept exactly as issued for five years (Tax Administration Act s29, VAT Act s55)",
  paymentRequest: "keep: the pro-forma behind a payment, a financial record",
  order: "keep: a sale, a financial record",
  sessionCreditTransaction: "keep: the credit ledger, a financial record",
  certificate: "keep: a number tied to the anonymous record; the PDF is generated on request from the (now erased) name",
  commitmentAcknowledgement: "keep: proof of consent (POPIA s11); IP and user agent are encrypted",
  documentAcceptance: "keep: proof of consent (POPIA s11); IP and user agent are encrypted",
  studentNote: "delete",
  quizAttempt: "delete",
  clientRelationship: "delete",
  relationshipInvite: "delete",
};

/**
 * Whose rows are whose. The eraser and the export (lib/popia/export-client.ts) both read these, so
 * what an erasure blanks and what an access request returns are the same rows. Until 2026-10-10 the
 * export read `studentId` alone and missed the walk-ins and address-matched mail the eraser took.
 */
/** Their bookings, plus walk-ins booked under their address before they had a record. */
export function ownBookings(studentId: string, email: string): Prisma.BookingWhereInput {
  return { OR: [{ studentId }, { studentId: null, clientEmail: { equals: email, mode: "insensitive" } }] };
}

/** Email sent to them, by record or by address. */
export function ownEmailLogs(studentId: string, email: string): Prisma.EmailLogWhereInput {
  return { OR: [{ studentId }, { to: { equals: email, mode: "insensitive" } }] };
}

/** Another client's couples booking that names them as the partner. */
export function partnerBookings(email: string): Prisma.BookingWhereInput {
  return { couplesPartnerEmail: { equals: email, mode: "insensitive" } };
}

/** Gifts bought for them, by record or by the address the buyer typed. */
export function receivedGifts(studentId: string, email: string): Prisma.GiftWhereInput {
  return { OR: [{ recipientId: studentId }, { recipientEmail: { equals: email, mode: "insensitive" } }] };
}

/** The columns of one model with one fate. The executor builds its updates from this. */
export function columnsWithFate(model: keyof typeof COLUMN_FATES, fate: "erase" | "clinical" | "partner"): string[] {
  return Object.entries(COLUMN_FATES[model])
    .filter(([, f]) => f === fate)
    .map(([c]) => c);
}
