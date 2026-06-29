import { prisma } from "@/lib/prisma";
import { normalizePhoneForStorage } from "@/lib/phone";

/**
 * Daily safety-net: canonicalise any stored phone numbers that aren't already E.164.
 *
 * New writes are normalised at the source (client/portal/booking actions via lib/phone),
 * so this normally finds nothing — it catches legacy rows and anything that slipped in
 * another way. Idempotent: only rows whose normalised value differs are written.
 *
 * Reads come back decrypted via the Prisma extension (student.phone, booking.clientPhone);
 * writes are re-encrypted automatically. billingEntity.phone is plaintext. Unparseable
 * values are left untouched (normalize returns them unchanged).
 */
export async function processPhoneNormalization(): Promise<{
  studentsFixed: number;
  bookingsFixed: number;
  entitiesFixed: number;
  failed: number;
}> {
  let studentsFixed = 0;
  let bookingsFixed = 0;
  let entitiesFixed = 0;

  const students = await prisma.student.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  for (const s of students) {
    if (!s.phone) continue;
    const normalized = normalizePhoneForStorage(s.phone);
    if (normalized && normalized !== s.phone) {
      await prisma.student.update({ where: { id: s.id }, data: { phone: normalized } });
      studentsFixed++;
    }
  }

  const bookings = await prisma.booking.findMany({
    where: { clientPhone: { not: null } },
    select: { id: true, clientPhone: true },
  });
  for (const b of bookings) {
    if (!b.clientPhone) continue;
    const normalized = normalizePhoneForStorage(b.clientPhone);
    if (normalized && normalized !== b.clientPhone) {
      await prisma.booking.update({ where: { id: b.id }, data: { clientPhone: normalized } });
      bookingsFixed++;
    }
  }

  const entities = await prisma.billingEntity.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  for (const e of entities) {
    if (!e.phone) continue;
    const normalized = normalizePhoneForStorage(e.phone);
    if (normalized && normalized !== e.phone) {
      await prisma.billingEntity.update({ where: { id: e.id }, data: { phone: normalized } });
      entitiesFixed++;
    }
  }

  return { studentsFixed, bookingsFixed, entitiesFixed, failed: 0 };
}
