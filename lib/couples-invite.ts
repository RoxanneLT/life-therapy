/**
 * lib/couples-invite.ts — the ONE place a couples partner gets told about a session.
 *
 * Four screens create a couples booking: the admin single booking, the admin recurring
 * series, the admin historical capture, and the client portal. Each built its own
 * version of "tell the partner", and they disagreed about everything that mattered —
 * whether the address was validated, whether the send result was read, whether a missing
 * address fell back to the linked partner's own.
 *
 * That divergence is the shape this codebase keeps paying for: a defence added at the
 * site where the bug was found, and absent at the siblings that answer the same question
 * (`dev-standards/LESSONS.md` L-21). Escaping reached one of five substitution helpers; an expiry
 * reached one of four credit paths; the calendar removal reached every cancel path but
 * two. Fixing the partner invite at one of four sites would have been the same story
 * told again, so the logic lives here and the sites call it.
 *
 * WHAT WENT WRONG, once, concretely: a partner address stored as `seanteres9@gmailcom` —
 * no dot before `com` — was refused by the provider before it was queued. `sendEmail`
 * returned the failure, the call site discarded it, and the only trace was a row in
 * `email_logs`, which nothing in the admin UI displays. The partner missed every session
 * for a week while everyone examined his mailbox.
 */

import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { isDeliverableEmail } from "@/lib/email-address";
import { findPartnerOf } from "@/lib/partner-link";

/**
 * Which address the invite should go to.
 *
 * A booking stores its OWN `couplesPartnerEmail`, captured on whichever form created it.
 * It does not read the partner's client record — two sources of truth for one person's
 * address, and the one an admin can see and edit on the client page is not the one that
 * sends. So fall back to the linked partner's own email when the booking has none.
 *
 * Of the first two couples sessions on record, one carried a malformed address and the
 * other carried NULL. NULL sends nothing at all, silently, which is the worse half.
 */
export async function resolvePartnerEmail(
  studentId: string,
  bookingPartnerEmail: string | null | undefined,
): Promise<string | null> {
  const given = bookingPartnerEmail?.trim() || null;
  if (given) return given;

  // findPartnerOf looks at BOTH ends of the relationship row. The first version of this
  // fallback filtered on `studentId` alone, and relationship rows are directional and
  // never written reciprocally — so it found the partner only when the booking's client
  // happened to be the side the row was entered from. For the couple this whole fix was
  // written for, the row is `Sean → Cassiel` and every booking is made under Cassiel, so
  // the fallback returned nothing and sent no invite. See lib/partner-link.ts.
  const linked = (await findPartnerOf(studentId))?.email ?? null;
  // Only if it can actually receive mail. A fallback that inherits a bad address is
  // worse than none, because it reads as deliberate.
  return isDeliverableEmail(linked) ? linked : null;
}

export interface CouplesInviteInput {
  bookingId: string;
  studentId: string | null;
  partnerTo: string;
  partnerName: string | null;
  clientName: string;
  sessionLabel: string;
  dateStr: string;
  timeStr: string;
  /** Pre-rendered HTML block with the Teams link, or "" for an in-person session. */
  teamsSection: string;
  baseUrl: string;
}

/**
 * Send the invite and REPORT what happened. Returns a warning a human can act on, or
 * null on success.
 *
 * The result is read here so no call site has to remember to. `sendEmail` returns
 * `{ success, error }` and never throws, so a bare `await` discards the only signal
 * there is — and a `Promise.allSettled` around it discards it twice over, because
 * "settled" is true whether the provider accepted the message or refused it.
 */
export async function sendCouplesPartnerInvite(
  input: CouplesInviteInput,
): Promise<string | null> {
  const rendered = await renderEmail(
    "couples_partner_invite",
    {
      partnerName: input.partnerName || "there",
      clientName: input.clientName,
      sessionType: input.sessionLabel,
      date: input.dateStr,
      time: input.timeStr,
      teamsSection: input.teamsSection,
    },
    input.baseUrl,
  );

  const sent = await sendEmail({
    to: input.partnerTo,
    ...rendered,
    templateKey: "couples_partner_invite",
    studentId: input.studentId ?? undefined,
    metadata: { bookingId: input.bookingId, partnerInvite: true },
  });

  if (sent.success) return null;

  return (
    `The session is booked, but the invite to ${input.partnerName || "the partner"} ` +
    `(${input.partnerTo}) was not delivered: ${sent.error ?? "unknown error"}. ` +
    `They have not been told about it.`
  );
}
