/**
 * Normalize phone numbers: convert local SA numbers (0xx...) to +27 format.
 *
 * Run with: npx tsx scripts/normalize-phone-numbers.ts
 *
 * Handles encrypted phone fields — decrypts, normalizes, re-encrypts.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { decrypt, encrypt } from "../lib/encryption";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Normalize a SA phone number: 0xx... → +27xx... */
function normalizePhone(phone: string): string | null {
  const stripped = phone.replace(/[\s\-()]/g, "");
  if (stripped.startsWith("0") && stripped.length >= 10 && !stripped.startsWith("+")) {
    return "+27" + stripped.slice(1);
  }
  return null; // No change needed
}

async function main() {
  console.log("=== Phone Number Normalization ===\n");

  // 1. Students
  const students = await prisma.student.findMany({
    where: { phone: { not: null } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });

  let studentCount = 0;
  for (const s of students) {
    if (!s.phone) continue;
    const decrypted = decrypt(s.phone);
    const normalized = normalizePhone(decrypted);
    if (normalized) {
      const encrypted = encrypt(normalized);
      await prisma.student.update({
        where: { id: s.id },
        data: { phone: encrypted },
      });
      console.log(`  Student: ${s.firstName} ${s.lastName} — ${decrypted} → ${normalized}`);
      studentCount++;
    }
  }
  console.log(`\nStudents updated: ${studentCount}/${students.length}\n`);

  // 2. Bookings (clientPhone)
  const bookings = await prisma.booking.findMany({
    where: { clientPhone: { not: null } },
    select: { id: true, clientName: true, clientPhone: true },
  });

  let bookingCount = 0;
  for (const b of bookings) {
    if (!b.clientPhone) continue;
    const decrypted = decrypt(b.clientPhone);
    const normalized = normalizePhone(decrypted);
    if (normalized) {
      const encrypted = encrypt(normalized);
      await prisma.booking.update({
        where: { id: b.id },
        data: { clientPhone: encrypted },
      });
      console.log(`  Booking: ${b.clientName} — ${decrypted} → ${normalized}`);
      bookingCount++;
    }
  }
  console.log(`\nBookings updated: ${bookingCount}/${bookings.length}\n`);

  // 3. Billing entities
  const entities = await prisma.billingEntity.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true },
  });

  let entityCount = 0;
  for (const e of entities) {
    if (!e.phone) continue;
    const decrypted = decrypt(e.phone);
    const normalized = normalizePhone(decrypted);
    if (normalized) {
      const encrypted = encrypt(normalized);
      await prisma.billingEntity.update({
        where: { id: e.id },
        data: { phone: encrypted },
      });
      console.log(`  Entity: ${e.name} — ${decrypted} → ${normalized}`);
      entityCount++;
    }
  }
  console.log(`\nBilling entities updated: ${entityCount}/${entities.length}\n`);

  // 4. Site settings
  const settings = await prisma.siteSetting.findFirst({
    select: { id: true, phone: true },
  });
  if (settings?.phone) {
    const normalized = normalizePhone(settings.phone);
    if (normalized) {
      await prisma.siteSetting.update({
        where: { id: settings.id },
        data: { phone: normalized },
      });
      console.log(`Site settings phone: ${settings.phone} → ${normalized}`);
    }
  }

  console.log("\n=== Done ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
