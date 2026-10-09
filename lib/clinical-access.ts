import type { AdminRole } from "@/lib/generated/prisma/client";

/**
 * Who may read a client's clinical record: the intake assessment and the free text written about
 * their sessions. Until 2026-10-09 the client profile sent all of it to every role that could open
 * the page, marketing included, because the page and its tab queries loaded whole rows. Marketing
 * needs a client's contact details and history, never what was said in a session.
 *
 * Withholding happens on the server, before serialisation. Hiding a tab only hides it: the props
 * and query results still reach the browser.
 */
export function canSeeClinical(role: AdminRole): boolean {
  return role === "super_admin";
}

/** Booking columns that hold free text about a session or the client. */
const CLINICAL_BOOKING_FIELDS = ["sessionNotes", "adminNotes", "cancellationReason"] as const;

/** A booking row with its clinical free text removed, for a role that may not read it. */
export function withoutClinicalBookingFields<T extends object>(booking: T): Omit<T, (typeof CLINICAL_BOOKING_FIELDS)[number]> {
  const copy = { ...booking } as Record<string, unknown>;
  for (const field of CLINICAL_BOOKING_FIELDS) delete copy[field];
  return copy as Omit<T, (typeof CLINICAL_BOOKING_FIELDS)[number]>;
}
