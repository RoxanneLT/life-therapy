/**
 * lib/partner-link.ts — who is this client's partner?
 *
 * A `ClientRelationship` row is DIRECTIONAL and is never written reciprocally. Measured
 * 2026-08-19: nine relationship rows, nine distinct pairs, **zero stored in both
 * directions**. So the row records "A is partnered to B" and there is no matching row
 * saying "B is partnered to A".
 *
 * Every reader therefore has to look at BOTH ends, and two of the four did not:
 *
 *   bookings/actions.ts   OR on both columns          — correct
 *   settings/actions.ts   OR on both columns          — correct
 *   book/actions.ts       studentId only              — found the partner from one side
 *   couples-invite.ts     studentId only              — same, and added the same morning
 *                                                       a lesson was written about this
 *                                                       exact class
 *
 * It is a coin flip which side a given couple was entered from, so the bug is invisible
 * half the time — and it landed on the couple whose broken invite started all of this:
 * the row is `Sean → Cassiel`, and every booking is made under CASSIEL, so a lookup from
 * her side found nothing and silently sent no invite.
 *
 * One lookup, both directions, so a fifth reader cannot get it wrong differently.
 */

import { prisma } from "@/lib/prisma";

export interface LinkedPartner {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
}

/**
 * The partner linked to this client, from whichever end the row was written, or null.
 *
 * Returns the OTHER person — never the client themselves — which is the only reason the
 * two-column query is not simply an `OR` at the call site: getting that wrong returns
 * the client as their own partner, which reads as success.
 */
export async function findPartnerOf(studentId: string | null | undefined): Promise<LinkedPartner | null> {
  if (!studentId) return null;

  const row = await prisma.clientRelationship.findFirst({
    where: {
      relationshipType: "partner",
      OR: [
        { studentId, relatedStudentId: { not: null } },
        { relatedStudentId: studentId },
      ],
    },
    select: {
      studentId: true,
      relatedStudentId: true,
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
      relatedStudent: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!row) return null;

  // Whichever end is NOT the client we asked about.
  const other = row.studentId === studentId ? row.relatedStudent : row.student;
  if (!other || other.id === studentId) return null;

  return { id: other.id, firstName: other.firstName, lastName: other.lastName, email: other.email };
}

/** Their display name, or null — the shape the booking forms want. */
export async function findPartnerName(studentId: string | null | undefined): Promise<string | null> {
  const p = await findPartnerOf(studentId);
  return p ? `${p.firstName} ${p.lastName || ""}`.trim() : null;
}
