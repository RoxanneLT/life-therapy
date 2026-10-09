import type { AdminRole } from "@/lib/generated/prisma/client";

/**
 * Who may read a client's clinical record: the intake assessment and the free text written about
 * their sessions. Until 2026-10-09 the client profile sent all of it to every role that could open
 * the page, marketing included, because the page and its tab queries loaded whole rows. Marketing
 * needs a client's contact details and history, never what was said in a session. The editor role
 * (bookings and content) could read and write booking notes until the same day; it now schedules
 * sessions without seeing or writing what is said in them.
 *
 * Withholding happens on the server, before serialisation. Hiding a tab only hides it: the props
 * and query results still reach the browser.
 */
export function canSeeClinical(role: AdminRole): boolean {
  return role === "super_admin";
}

/** Booking columns that hold free text about a session or the client (the "clinical" fate in lib/popia/plan.ts). */
const CLINICAL_BOOKING_FIELDS = ["sessionNotes", "adminNotes", "clientNotes", "cancellationReason"] as const;

/**
 * A booking row with its clinical free text blanked to null, for a role that may not read it.
 * Null rather than absent, so a page renders the row as one without notes and keeps its types.
 */
export function withoutClinicalBookingFields<T extends object>(booking: T): T {
  const copy = { ...booking } as Record<string, unknown>;
  for (const field of CLINICAL_BOOKING_FIELDS) if (field in copy) copy[field] = null;
  return copy as T;
}
