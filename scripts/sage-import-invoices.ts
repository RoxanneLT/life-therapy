/**
 * Sage transition import — Creates completed Booking records (unbilled)
 * so they are picked up by the normal month-end postpaid billing run.
 *
 * Usage:
 *   Dry run:     npx tsx scripts/sage-import-invoices.ts
 *   Live import: npx tsx scripts/sage-import-invoices.ts --live
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = !process.argv.includes("--live");
const INDIVIDUAL_CENTS = 89500;  // R895
const COUPLES_CENTS    = 129500; // R1295

// ─── Confirmed matches ────────────────────────────────────────────────────────
// Skipped: Bianca (left old system), Daniel (not needed), Andrea Behnsen (not in Sage export)
// Gloria Killian (Aiden) → billed to Simone Kilian (mother, primary billing contact)
// Winifred & Ricardo Michaels → billed to Winifred Michaels (primary billing contact)
const IMPORT_RECORDS = [
  { sage_doc: "INV-LT-203272", studentId: "cmlgc8ohg00a604ju22vgslgs", date: "2026-03-04", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203274", studentId: "cmlgc86tl004x04jurxi5uooj", date: "2026-03-04", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203276", studentId: "cmlgc849q004604ju0nwzbk69", date: "2026-03-04", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203277", studentId: "cmlgc89wo005u04juiuhb31wt", date: "2026-03-05", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203271", studentId: "cmma8ykq4000004l4agrdfnna", date: "2026-03-04", total_rand: 1790, type: "individual" as const },
  { sage_doc: "INV-LT-203282", studentId: "cmlgc8d9l006u04jufyt9v7ld", date: "2026-03-09", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203270", studentId: "cmlgc8lp1009c04juze7pjzh9", date: "2026-03-04", total_rand: 1790, type: "individual" as const },
  { sage_doc: "INV-LT-203283", studentId: "cmlgc7tuq001304jue8ir0rz5", date: "2026-03-10", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203284", studentId: "cmmt1zp0d000004l1ezwy36uk", date: "2026-03-10", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203285", studentId: "cmlgc7vjn001l04ju635btqz9", date: "2026-03-10", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203273", studentId: "cmlgc7zro002u04jux46726g3", date: "2026-03-04", total_rand: 1790, type: "individual" as const },
  { sage_doc: "INV-LT-203286", studentId: "cmlgc80by003004juy4t20p71", date: "2026-03-11", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203275", studentId: "cmlgc8ey5007c04juxmlm00sz", date: "2026-03-04", total_rand: 1790, type: "individual" as const },
  { sage_doc: "INV-LT-203288", studentId: "cmlgc8ic2008c04jun4idrjmk", date: "2026-03-12", total_rand: 895,  type: "individual" as const },
  { sage_doc: "INV-LT-203266", studentId: "cmlgc8886005c04jutp0ozf0t", date: "2026-03-02", total_rand: 1790, type: "individual" as const },
  { sage_doc: "INV-LT-203280", studentId: "cmms8kkgs000004l81lck1btc", date: "2026-03-09", total_rand: 895,  type: "individual" as const },
  // Gloria Killian (Aiden) → Simone Kilian is the billing contact
  { sage_doc: "INV-LT-203268", studentId: "cmlgc8542004f04ju5dp4sjhl", date: "2026-03-02", total_rand: 1790, type: "individual" as const },
  // Winifred & Ricardo Michaels → Winifred is the billing contact
  { sage_doc: "INV-LT-203267", studentId: "cmlgc7qg6000304ju6fgeng1i", date: "2026-03-02", total_rand: 1295, type: "couples"    as const },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${DRY_RUN ? "🔍 DRY RUN — no changes will be made" : "🚀 LIVE IMPORT"}`);

  const students = await prisma.student.findMany({
    where: { id: { in: IMPORT_RECORDS.map((r) => r.studentId) } },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  const studentMap = new Map(students.map((s) => [s.id, s]));

  let totalBookings = 0;

  // Count total bookings to create
  for (const r of IMPORT_RECORDS) {
    const unitCents = r.type === "couples" ? COUPLES_CENTS : INDIVIDUAL_CENTS;
    totalBookings += Math.round((r.total_rand * 100) / unitCents);
  }

  console.log(`Importing ${IMPORT_RECORDS.length} Sage records → ${totalBookings} completed bookings\n`);
  console.log("─".repeat(80));

  let created = 0;

  for (const record of IMPORT_RECORDS) {
    const student = studentMap.get(record.studentId);
    if (!student) {
      console.log(`⚠️  Student not found for ${record.sage_doc} — skipping`);
      continue;
    }

    const unitCents   = record.type === "couples" ? COUPLES_CENTS : INDIVIDUAL_CENTS;
    const sessionType = record.type === "couples" ? "couples" : "individual";
    const duration    = record.type === "couples" ? 90 : 60;
    const endTime     = record.type === "couples" ? "10:30" : "10:00";
    const sessions    = Math.round((record.total_rand * 100) / unitCents);

    console.log(`${DRY_RUN ? "📋" : "✅"} ${record.sage_doc}  ${`${student.firstName} ${student.lastName}`.padEnd(26)} ${sessions}× ${record.type}  (R${record.total_rand / sessions} each)`);

    for (let i = 0; i < sessions; i++) {
      // Space multiple sessions 7 days apart, capped at 28th to stay in March
      const sessionDate = new Date(record.date);
      sessionDate.setDate(Math.min(sessionDate.getDate() + i * 7, 28));

      if (!DRY_RUN) {
        const existing = await prisma.booking.findFirst({
          where: { adminNotes: { contains: `Sage ref: ${record.sage_doc}` } },
        });
        if (existing) {
          console.log(`  ⏭️  Already imported — skipping`);
          continue;
        }
        await prisma.booking.create({
          data: {
            sessionType,
            date:            sessionDate,
            startTime:       "09:00",
            endTime,
            durationMinutes: duration,
            priceZarCents:   unitCents,
            clientName:      `${student.firstName} ${student.lastName}`,
            clientEmail:     student.email,
            clientPhone:     student.phone ?? undefined,
            status:          "completed",
            sessionMode:     "in_person",
            studentId:       student.id,
            adminNotes:      `Outstanding session(s) imported to new Life-Therapy system (Sage ref: ${record.sage_doc})`,
            // invoiceId and paymentRequestId left null → unbilled → picked up by month-end billing
          },
        });
      }
      created++;
    }
  }

  console.log("\n" + "─".repeat(80));
  console.log(`\nSummary: ${DRY_RUN ? "Would create" : "Created"} ${created} completed bookings`);

  if (DRY_RUN) {
    console.log(`\nLooks good? Run with --live to import:\n  npx tsx scripts/sage-import-invoices.ts --live\n`);
  } else {
    console.log(`\nDone. Sessions are now in the unbilled pool — they will be included in the next month-end billing run.\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
