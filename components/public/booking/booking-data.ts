import type { SessionTypeConfig } from "@/lib/booking-config";
import type { TimeSlot } from "@/lib/availability";

/**
 * What the public booking widget has collected so far.
 *
 * In its own module because it is shared by the widget AND by the step components the
 * widget renders. Declared on the widget, it made every step import back from its own
 * parent — a genuine import cycle, and the only two in the tree
 * (`npm run check:cycles`).
 *
 * The imports were type-only, so nothing broke at runtime: TypeScript erases them and
 * the bundler never saw the loop. That is exactly why it survived — a cycle that costs
 * nothing today still decides what a later change is allowed to do, because the moment
 * a step needs a VALUE from the widget the loop becomes real and the failure is a
 * module-initialisation error a long way from this file.
 */
export interface BookingData {
  sessionType: SessionTypeConfig | null;
  date: string | null; // "2026-02-10"
  slot: TimeSlot | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientNotes: string;
}
