/**
 * What a session reminder was ABOUT, so a changed session is reminded again.
 *
 * Until 2026-09-30 a reminder was "sent" once per booking, full stop: a stamp, checked for
 * null. A booking moved after its reminder went out kept the stamp, and the new time got
 * nothing. Genevieve Chang's 30 Sep session was reminded on 29 Sep, moved to 1 Oct, and no
 * reminder was due for 1 Oct. Clearing the stamp on reschedule fixed one path of four — the
 * portal self-reschedule, the series reschedule and the series calendar rebuild all still
 * left it set — and every new path would have had to remember too.
 *
 * So the reader decides: each stamp is paired with a fingerprint of what the message said,
 * and a reminder is due when there is none, or when the booking no longer matches it.
 *
 * Deliberately NOT the calendar event id, which was the first idea: it changes on a repair
 * or recreate that leaves the session where it was (every such repair would re-remind
 * everyone in the next 24h), and it can stay put when a series occurrence moves, because
 * siblings share the master id. The fingerprint is what the client READ. The email carries
 * the Teams link, so a recreated meeting — whose old link is dead — re-sends it; the
 * WhatsApp messages name only the day and time, so a new link alone does not re-send those.
 */

export type ReminderKind = "email" | "whatsapp24h" | "whatsappImminent";

export interface RemindedBooking {
  /** The @db.Date column, UTC midnight — sliced, which is exact for a day column. */
  date: Date;
  startTime: string;
  teamsMeetingUrl: string | null;
}

export function reminderFingerprint(kind: ReminderKind, b: RemindedBooking): string {
  const day = b.date.toISOString().slice(0, 10);
  return kind === "email"
    ? `${day}|${b.startTime}|${b.teamsMeetingUrl ?? ""}`
    : `${day}|${b.startTime}`;
}

/**
 * Is this reminder due, given its stamp and what it was sent for?
 *
 * A stamp with no fingerprint was written before fingerprints existed; it counts as
 * current, so deploying this re-sends nothing to anyone. A fingerprint without a stamp
 * cannot be written (both are set by one claim and cleared by one release).
 */
export function reminderDue(
  sentAt: Date | null,
  sentFor: string | null,
  current: string,
): boolean {
  if (sentAt === null) return true;
  return sentFor !== null && sentFor !== current;
}
