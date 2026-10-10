import { prisma } from "@/lib/prisma";

/**
 * The refusal an admin action returns instead of writing to an erased client, or null.
 *
 * An erasure blanks the record and keeps the row (lib/popia/erase-client.ts). Until 2026-10-10
 * every edit action still accepted it, so retyping a name, a phone number or an intake on the
 * client page put back the personal data the erasure had removed, and the page kept the
 * "Erased under POPIA" line above it. The audit check "popia: an admin action does not write to
 * an erased client" requires this call in any action that writes a Student or intake row.
 */
export async function erasedRefusal(studentId: string): Promise<string | null> {
  const s = await prisma.student.findUnique({ where: { id: studentId }, select: { erasedAt: true } });
  return s?.erasedAt ? "This client was erased under POPIA, so their record can no longer be changed." : null;
}
