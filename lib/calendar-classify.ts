/**
 * lib/calendar-classify.ts — the PURE matching core of calendar reconciliation.
 *
 * Extracted from calendar-reconcile.ts so the decisions that caused the 2026-06/07
 * incident can be tested against literal fixtures with no Prisma, no Graph, no network:
 * which bookings are missing an event, which events are ghosts, which are surplus
 * duplicates, and — critically — what may safely be done about each.
 *
 * This module PROPOSES. It never acts. calendar-reconcile.ts fetches and calls
 * classify(); an explicit, approved, re-verified apply step performs any write.
 */

/**
 * What the tool suggests for a finding. `none` means a human must look — either the
 * safe action is unknowable from the data, or acting automatically is what caused the
 * incident in the first place.
 */
export type ProposedAction = "delete" | "create" | "reschedule_series" | "none";

/** A booking, already resolved to its SAST calendar day. */
export interface ClassifyBooking {
  id: string;
  date: string; // YYYY-MM-DD (SAST)
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  clientName: string;
  /** The Graph event this booking believes it owns. For a recurring series every
   *  booking carries the SERIES MASTER id, not a per-occurrence id. */
  graphEventId: string | null;
  /** Recurring occurrences are never auto-created — recreating one forks the series. */
  isRecurring: boolean;
}

/** A session event read off the calendar, already parsed. */
export interface ClassifyEvent {
  id: string;
  subject: string;
  date: string; // YYYY-MM-DD (SAST)
  start: string; // "HH:mm"
  end: string; // "HH:mm"
  clientName: string;
  /** For an expanded occurrence of a recurring series, the id of its master event.
   *  calendarView returns occurrences with their OWN ids, so this is the only honest
   *  way a booking holding a master id can claim its occurrence. */
  seriesMasterId?: string | null;
}

export interface ClassifiedMismatch {
  bookingId: string;
  clientName: string;
  date: string;
  bookingTime: string;
  outlookTime: string;
  /** Always "none" for now — duration drift is reported, not auto-corrected. */
  proposal: ProposedAction;
}

export interface ClassifiedMissing {
  bookingId: string;
  clientName: string;
  date: string;
  /** Display form, "HH:mm–HH:mm". */
  time: string;
  startTime: string;
  endTime: string;
  reason: "no_graph_id" | "event_not_found";
  isRecurring: boolean;
  /** Single bookings can be recreated directly; a recurring gap must go through the
   *  series rebuild, because creating one standalone occurrence forks the series. */
  proposal: ProposedAction;
}

export interface ClassifiedOrphan {
  graphEventId: string;
  subject: string;
  clientName: string;
  date: string;
  start: string;
  /** False when the guard refuses deletion — the client still has a missing booking,
   *  so this is a suspected wrong-day twin rather than a stale duplicate. */
  deletable: boolean;
  proposal: ProposedAction;
  /** Why the guard refused, when it did. */
  reason?: string;
}

export interface ClassifiedDuplicate {
  graphEventId: string;
  subject: string;
  clientName: string;
  date: string;
  start: string;
  /** The booking this slot belongs to. */
  bookingId: string;
  /** "delete" only when the booking provably owns a DIFFERENT event in this slot, so
   *  this one is demonstrably surplus. "none" when ownership can't be established and
   *  deleting either could sever the invite the client actually holds. */
  proposal: ProposedAction;
  reason: string;
}

export interface Classification {
  checked: number;
  matched: number;
  mismatched: ClassifiedMismatch[];
  missing: ClassifiedMissing[];
  orphaned: ClassifiedOrphan[];
  /** Extra events sitting in a slot that already has a matched booking. Invisible
   *  before this existed — which is how a manually-added entry sat alongside a rebuilt
   *  occurrence while the reconcile still reported a clean 0/0. */
  duplicates: ClassifiedDuplicate[];
}

/** Normalise a client name for matching: lowercase, collapse internal whitespace. */
export function normName(clientName: string): string {
  return clientName.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Session events are titled "{label} — {clientName}". Anything else is personal. */
export function isSessionSubject(subject: string): boolean {
  return subject.includes(" — ");
}

/**
 * The client name out of an event subject.
 *
 * Strips the " (In Person)" suffix that admin bookings append AFTER the name — without
 * this, an in-person event parsed to "Name (In Person)", never matched its booking, and
 * so reported as missing AND had its real event deleted as a ghost (bug #3).
 */
export function parseClientName(subject: string): string {
  return subject
    .split(" — ")
    .slice(1)
    .join(" — ")
    .trim()
    .replace(/\(In Person\)$/i, "") // no \s* prefix — the trailing trim() handles spacing
    .trim();
}

/** Match key: a booking and an event are "the same" if day, start time and client agree. */
export function matchKey(date: string, start: string, clientName: string): string {
  return `${date}|${start}|${normName(clientName)}`;
}

/**
 * Does this event demonstrably belong to this booking?
 *
 * Two ways: the booking points straight at it (a single booking), or the event is an
 * expanded occurrence whose master is what the booking points at (a recurring series).
 * Matching only on `id` would be wrong for every recurring occurrence, since
 * calendarView gives occurrences their own ids.
 */
export function eventBelongsToBooking(ev: ClassifyEvent, booking: ClassifyBooking): boolean {
  if (!booking.graphEventId) return false;
  return ev.id === booking.graphEventId || ev.seriesMasterId === booking.graphEventId;
}

/**
 * A ghost is safe to delete ONLY if its client has NO booking left unmatched this run.
 *
 * If the same client still has a missing booking, the ghost is almost certainly the
 * wrong-day twin of that now-eventless booking (Mia 2026-07-09, Chanene 2026-07-21) —
 * deleting it is the silent data loss. If every one of the client's bookings matched,
 * the ghost is a true duplicate (the booking is already satisfied by another event —
 * the harmless 2026-06-24 cleanup) and stays deletable.
 *
 * This is deliberately NOT "never delete a recurring occurrence": that blanket rule
 * would have blocked June's correct cleanup and let stale duplicates accumulate forever.
 */
export function isGhostDeletable(
  ghostClientNorm: string,
  clientsWithMissingBookings: Set<string>,
): boolean {
  return !clientsWithMissingBookings.has(ghostClientNorm);
}

/**
 * Roll the missing set up per client: who is eventless, how many sessions, and the
 * soonest one. This is what gets persisted on every check-only run — the Mia incident
 * sat unnoticed for twelve days precisely because the logs recorded a bare count
 * ("missing: 26") and never a name.
 *
 * Sorted by soonest session, because that is the repair priority: an eventless booking
 * two days out is a session about to be missed.
 */
export function summariseMissingByClient(
  missing: Array<{ clientName: string; date: string }>,
): Array<{ client: string; count: number; nextDate: string }> {
  const byClient = new Map<string, { client: string; count: number; nextDate: string }>();
  for (const m of missing) {
    const existing = byClient.get(m.clientName);
    if (existing) {
      existing.count++;
      if (m.date < existing.nextDate) existing.nextDate = m.date;
    } else {
      byClient.set(m.clientName, { client: m.clientName, count: 1, nextDate: m.date });
    }
  }
  return [...byClient.values()].sort((a, b) => a.nextDate.localeCompare(b.nextDate));
}

/**
 * Compare bookings (the source of truth) against calendar events, and propose what to
 * do about each discrepancy. Proposes only — nothing here writes.
 *
 * Forward pass — every booking should have an event at its day/start/client:
 *   found, same end time      → matched (extras in that slot become duplicates)
 *   found, different end time → mismatched (duration drift, reported only)
 *   not found                 → missing (create, or rebuild the series if recurring)
 * Reverse pass — session events belonging to no booking are ghosts, each marked
 * deletable or protected by the guard above.
 */
export function classify(
  bookings: ClassifyBooking[],
  events: ClassifyEvent[],
): Classification {
  const out: Classification = {
    checked: 0,
    matched: 0,
    mismatched: [],
    missing: [],
    orphaned: [],
    duplicates: [],
  };

  const byKey = indexEventsByKey(events);
  const consumed = new Set<string>();

  for (const b of bookings) {
    out.checked++;
    const key = matchKey(b.date, b.startTime, b.clientName);
    const candidates = byKey.get(key);

    if (!candidates?.length) {
      out.missing.push(missingFor(b));
      continue;
    }

    consumed.add(key);
    if (candidates.some((c) => c.end === b.endTime)) {
      out.matched++;
    } else {
      out.mismatched.push({
        bookingId: b.id,
        clientName: b.clientName,
        date: b.date,
        bookingTime: `${b.startTime}–${b.endTime}`,
        outlookTime: `${b.startTime}–${candidates[0].end}`,
        proposal: "none",
      });
    }
    out.duplicates.push(...surplusInSlot(candidates, b));
  }

  // The guard's input: clients that still have at least one eventless booking.
  const clientsWithMissingBookings = new Set(out.missing.map((m) => normName(m.clientName)));
  out.orphaned.push(...collectOrphans(events, consumed, clientsWithMissingBookings));

  return out;
}

function indexEventsByKey(events: ClassifyEvent[]): Map<string, ClassifyEvent[]> {
  const byKey = new Map<string, ClassifyEvent[]>();
  for (const ev of events) {
    const k = matchKey(ev.date, ev.start, ev.clientName);
    byKey.set(k, [...(byKey.get(k) ?? []), ev]);
  }
  return byKey;
}

function missingFor(b: ClassifyBooking): ClassifiedMissing {
  return {
    bookingId: b.id,
    clientName: b.clientName,
    date: b.date,
    time: `${b.startTime}–${b.endTime}`,
    startTime: b.startTime,
    endTime: b.endTime,
    reason: b.graphEventId ? "event_not_found" : "no_graph_id",
    isRecurring: b.isRecurring,
    // A recurring gap must be repaired by rebuilding the whole series; creating a lone
    // occurrence forks it and hands the client a different meeting than the coach.
    proposal: b.isRecurring ? "reschedule_series" : "create",
  };
}

/**
 * One booking cannot justify several events in the same slot; the ones it does not own
 * are surplus. Deleting is only PROPOSED when ownership is provable — otherwise the
 * wrong choice severs the invite the client is actually holding, so a human picks.
 */
function surplusInSlot(
  candidates: ClassifyEvent[],
  b: ClassifyBooking,
): ClassifiedDuplicate[] {
  if (candidates.length <= 1) return [];
  const owned = candidates.find((c) => eventBelongsToBooking(c, b));
  return candidates
    .filter((c) => c.id !== owned?.id) // no owner → every candidate is reported
    .map((c) => ({
      graphEventId: c.id,
      subject: c.subject,
      clientName: c.clientName,
      date: c.date,
      start: c.start,
      bookingId: b.id,
      proposal: owned ? ("delete" as const) : ("none" as const),
      reason: owned
        ? "Surplus — the booking owns a different event in this slot"
        : "Several events in one slot and none is linked to the booking — pick which to keep",
    }));
}

function collectOrphans(
  events: ClassifyEvent[],
  consumed: Set<string>,
  clientsWithMissingBookings: Set<string>,
): ClassifiedOrphan[] {
  const out: ClassifiedOrphan[] = [];
  for (const ev of events) {
    if (consumed.has(matchKey(ev.date, ev.start, ev.clientName))) continue;
    const deletable = isGhostDeletable(normName(ev.clientName), clientsWithMissingBookings);
    out.push({
      graphEventId: ev.id,
      subject: ev.subject,
      clientName: ev.clientName,
      date: ev.date,
      start: ev.start,
      deletable,
      proposal: deletable ? "delete" : "none",
      ...(deletable
        ? {}
        : {
            reason:
              "Suspected wrong-day session — this client still has sessions with no event. Rebuild their series instead of deleting.",
          }),
    });
  }
  return out;
}
