import { prisma } from "@/lib/prisma";
import { calendarDate, saToday } from "@/lib/dates";
import { columnsWithFate } from "@/lib/popia/plan";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * The clinical half of an erasure, deferred: intake answers and session/admin notes are kept,
 * attached only to the anonymous record, until Student.retainUntil (five years after the last
 * session, privacy policy §6), then removed here. lib/popia/plan.ts names the columns.
 *
 * Returned as operations, not run, so the erasure can put them in its own transaction when the
 * retention window has already passed.
 */
export function clinicalPurgeOps(studentId: string) {
  const bookingNulls = Object.fromEntries(columnsWithFate("booking", "clinical").map((c) => [c, null]));
  return [
    prisma.clientIntake.deleteMany({ where: { studentId } }),
    prisma.booking.updateMany({ where: { studentId }, data: bookingNulls as Prisma.BookingUpdateManyMutationInput }),
    prisma.student.update({ where: { id: studentId }, data: { adminNotes: null, retainUntil: null } }),
  ];
}

/** Daily cron: purge what erased clients' retention windows no longer cover. */
export async function purgeRetainedClinicalRecords(): Promise<{ purged: number }> {
  const due = await prisma.student.findMany({
    where: { erasedAt: { not: null }, retainUntil: { lte: calendarDate(saToday()) } },
    select: { id: true },
  });
  for (const { id } of due) {
    await prisma.$transaction(clinicalPurgeOps(id));
  }
  return { purged: due.length };
}
