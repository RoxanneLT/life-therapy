/**
 * lib/calendar-classify.ts — the PURE matching core of calendar reconciliation.
 *
 * Extracted from calendar-reconcile.ts so the decisions that caused the 2026-06/07
 * incident can be tested against literal fixtures with no Prisma, no Graph, no network:
 * which bookings are missing an event, which events are ghosts, and — critically —
 * which ghosts may be deleted.
 *
 * calendar-reconcile.ts fetches, calls classify(), then performs the I/O the
 * classification implies. Everything judgemental lives here.
 */

/** A booking, already resolved to its SAST calendar day. */
export interface ClassifyBooking {
  id: string;
  date: string; // YYYY-MM-DD (SAST)
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  clientName: string;
  /** Whether the booking row carries a graphEventId — drives the "missing" reason. */
  hasGraphEvent: boolean;
  /** Recurring occurrences are never auto-created (recreating one forks the series). */
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
}

export interface ClassifiedMismatch {
  bookingId: string;
  clientName: string;
  date: string;
  bookingTime: string;
  outlookTime: string;
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
}

export interface Classification {
  checked: number;
  matched: number;
  mismatched: ClassifiedMismatch[];
  missing: ClassifiedMissing[];
  orphaned: ClassifiedOrphan[];
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
 * Compare bookings (the source of truth) against calendar events.
 *
 * Forward pass — every booking should have an event at its day/start/client:
 *   found + same end time → matched
 *   found + different end → mismatched (duration drift)
 *   not found            → missing
 * Reverse pass — every session event should belong to a booking; those that don't are
 * ghosts, each marked deletable or protected by the guard above.
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
  };

  const byKey = new Map<string, ClassifyEvent[]>();
  for (const ev of events) {
    const k = matchKey(ev.date, ev.start, ev.clientName);
    byKey.set(k, [...(byKey.get(k) ?? []), ev]);
  }

  const consumed = new Set<string>();
  for (const b of bookings) {
    out.checked++;
    const k = matchKey(b.date, b.startTime, b.clientName);
    const candidates = byKey.get(k);

    if (candidates?.length) {
      consumed.add(k);
      if (candidates.some((c) => c.end === b.endTime)) {
        out.matched++;
      } else {
        out.mismatched.push({
          bookingId: b.id,
          clientName: b.clientName,
          date: b.date,
          bookingTime: `${b.startTime}–${b.endTime}`,
          outlookTime: `${b.startTime}–${candidates[0].end}`,
        });
      }
      continue;
    }

    out.missing.push({
      bookingId: b.id,
      clientName: b.clientName,
      date: b.date,
      time: `${b.startTime}–${b.endTime}`,
      startTime: b.startTime,
      endTime: b.endTime,
      reason: b.hasGraphEvent ? "event_not_found" : "no_graph_id",
      isRecurring: b.isRecurring,
    });
  }

  // The guard's input: clients that still have at least one eventless booking.
  const clientsWithMissingBookings = new Set(out.missing.map((m) => normName(m.clientName)));

  for (const ev of events) {
    const k = matchKey(ev.date, ev.start, ev.clientName);
    if (consumed.has(k)) continue;
    out.orphaned.push({
      graphEventId: ev.id,
      subject: ev.subject,
      clientName: ev.clientName,
      date: ev.date,
      start: ev.start,
      deletable: isGhostDeletable(normName(ev.clientName), clientsWithMissingBookings),
    });
  }

  return out;
}
