/**
 * lib/email-address.ts — is this address one a mail provider will accept?
 *
 * WHY THIS EXISTS, and it is not theoretical. A couples session was booked with the
 * partner's address typed as `seanteres9@gmailcom` — no dot before `com`. The invite
 * was built, sent, and refused by the provider with "Invalid `to` field". The partner
 * never heard about a session he was expected at, and it read to everyone as "he
 * doesn't get our emails".
 *
 * It passed the two gates that existed:
 *
 *   1. `<Input type="email">`. HTML5 email validation does NOT require a dot in the
 *      domain — `foo@gmailcom` is a VALID value per the spec, because intranet hosts
 *      are legal addresses. The browser was right; the assumption about it was wrong.
 *   2. Nothing on the server. The value went straight to the column.
 *
 * DELIBERATELY NOT RFC 5322. That grammar accepts quoted local parts, comments, and
 * bare hostnames, and rejecting a real address is worse here than accepting an odd
 * one: the cost of a false negative is refusing a client's genuine email, the cost of
 * a false positive is one logged failure. This asks the narrower question the incident
 * actually needed — is there a dotted domain a public mail provider could route to.
 */

/**
 * True when the address is plausibly deliverable: one `@`, a non-empty local part, and
 * a domain with at least one dot and a 2+ character final label.
 *
 * Not a guarantee of delivery — a well-formed address can still bounce, be suppressed,
 * or belong to nobody. Anything that must KNOW an email arrived has to read the send
 * result, not this.
 */
export function isDeliverableEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  const s = value.trim();
  if (s !== value) return false; // stray whitespace is nearly always a paste error
  if (s.length > 254) return false; // RFC 5321 limit on the whole path
  return /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(s);
}

/**
 * A refusal a human reads, or null when the address is fine. Returned, never thrown —
 * Next.js strips a thrown message in production and shows React's digest instead, so
 * the reason would be the one thing the admin could not see.
 */
export function emailRefusal(value: string | null | undefined, label: string): string | null {
  if (!value || !value.trim()) return null; // absent is a different question from malformed
  if (isDeliverableEmail(value)) return null;
  return `${label} doesn't look like a working email address ("${value.trim()}"). Check for a missing dot or a typo — the invite will be rejected before it is sent.`;
}
