/**
 * Removing ONE booking's calendar entry, without guessing what kind of event it is.
 *
 * Every cancel/reschedule path branched on `recurringSeriesId`:
 *
 *     if (booking.recurringSeriesId) deleteRecurringEventOccurrences(id, [date])
 *     else                           cancelCalendarEvent(id)
 *
 * which reads as "is this booking part of a series?" but is answering a different
 * question: "is `graphEventId` a SERIES MASTER?" Those come apart whenever a series
 * exists whose bookings each hold their own standalone event — which is the norm for
 * anything created before the one-event-per-series refactor. Cheslon Faroa's series,
 * for instance, has seven bookings carrying seven distinct sequential event ids.
 *
 * One direction of that mistake is catastrophic: treating a master as a single event
 * deleted fifty real sessions in July 2026. The other direction is currently absorbed
 * further down — `deleteRecurringEventOccurrences` reads the event's `type` and falls
 * back to a direct delete when it isn't a `seriesMaster` (lib/graph.ts, since June).
 * That backstop is why the wrong branch has not been visibly losing events, and it is
 * exactly the kind of load-bearing accident that should not be left implicit: the
 * branch above still asks the wrong question, and the only thing making it come out
 * right is a rescue two layers away.
 *
 * So stop inferring it here. Whether an id is a master is a fact about the DATA: a
 * master is shared by its siblings, a standalone event is held by exactly one
 * booking. Count, don't guess — and let the Graph-layer type check be a backstop
 * rather than the mechanism.
 *
 * NOTE ON THE GHOST THIS WAS BUILT FOR: Cheslon's 10 Sep session was cancelled on
 * 13 Aug and stayed live in Outlook, but NOT because of this branch. It was cancelled
 * from the client detail page, whose two cancel actions never mentioned the calendar
 * at all — no Graph call, and no calendar_sync_log row to show for it. A missing
 * branch, not a wrong one. Both now call through here.
 */

import { prisma } from "@/lib/prisma";
import { cancelCalendarEvent, deleteRecurringEventOccurrences } from "@/lib/graph";
import { saDateStr } from "@/lib/dates";

/**
 * How to remove one booking's entry, given how many bookings share its event id.
 *
 * Pure, so the rule can be pinned by a test rather than discovered in production.
 * `sharedCount` counts every booking holding that `graphEventId`, INCLUDING the
 * one being removed — so 1 means "only this booking", and the event belongs to it
 * alone.
 */
export function removalMode(sharedCount: number): "occurrence" | "whole-event" {
  // Defensive on 0: a count of zero means the booking's own row was not seen, so
  // the safest reading is "this id is not shared" — deleting one occurrence from a
  // non-master is a no-op, while cancelling a master would take the whole series.
  // Wrong in the harmless direction.
  return sharedCount > 1 ? "occurrence" : "whole-event";
}

/**
 * Remove a single booking's calendar entry. Never throws — a calendar failure must
 * not roll back a cancellation the client has already been told about.
 *
 * Returns what it did, so callers can warn when Outlook is now out of step.
 */
export async function removeBookingFromCalendar(booking: {
  id: string;
  graphEventId: string | null;
  date: Date;
}): Promise<{ removed: boolean; mode: "occurrence" | "whole-event" | "none"; warning?: string }> {
  if (!booking.graphEventId) return { removed: false, mode: "none" };

  try {
    const sharedCount = await prisma.booking.count({
      where: { graphEventId: booking.graphEventId },
    });
    const mode = removalMode(sharedCount);

    if (mode === "occurrence") {
      const res = await deleteRecurringEventOccurrences(booking.graphEventId, [
        saDateStr(booking.date),
      ]);
      if (res.failed.length > 0) {
        return {
          removed: false,
          mode,
          warning: "Calendar event could not be removed — delete it manually in Outlook.",
        };
      }
      return { removed: true, mode };
    }

    await cancelCalendarEvent(booking.graphEventId);
    return { removed: true, mode };
  } catch (err) {
    console.error(`[calendar-removal] booking ${booking.id}:`, err);
    return {
      removed: false,
      mode: "none",
      warning: "Calendar event could not be removed — delete it manually in Outlook.",
    };
  }
}
