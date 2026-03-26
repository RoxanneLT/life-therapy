/**
 * Dry-run: checks that all Sage-imported bookings will be picked up
 * by the month-end postpaid billing run.
 *
 * Conditions required (from lib/generate-payment-requests.ts):
 *   1. booking.status in ["completed", "no_show"]
 *   2. booking.invoiceId IS NULL
 *   3. booking.paymentRequestId IS NULL
 *   4. student.billingType === "postpaid"
 *   5. booking.date within March 2026 billing period
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const bookings = await prisma.booking.findMany({
    where: { adminNotes: { contains: "Sage ref: INV-LT-" } },
    include: { student: { select: { id: true, firstName: true, lastName: true, billingType: true } } },
    orderBy: { date: "asc" },
  });

  console.log(`\nFound ${bookings.length} imported Sage bookings\n`);
  console.log("─".repeat(80));

  let readyCount = 0;
  let issueCount = 0;

  for (const b of bookings) {
    const issues: string[] = [];

    if (b.status !== "completed" && b.status !== "no_show")
      issues.push(`status is "${b.status}" (need completed/no_show)`);
    if (b.invoiceId !== null)
      issues.push(`already has invoiceId: ${b.invoiceId}`);
    if (b.paymentRequestId !== null)
      issues.push(`already has paymentRequestId: ${b.paymentRequestId}`);
    if (!b.student)
      issues.push(`no student record linked`);
    else if (b.student.billingType !== "postpaid")
      issues.push(`billingType is "${b.student.billingType}" (need postpaid)`);

    const name  = b.student ? `${b.student.firstName} ${b.student.lastName}` : b.clientName;
    const label = `${name.padEnd(26)} ${b.sessionType.padEnd(12)} ${b.date.toISOString().slice(0, 10)}`;
    const ref   = (b.adminNotes?.match(/INV-LT-\d+/) ?? ["?"])[0];

    if (issues.length === 0) {
      console.log(`✅  ${label}  [${ref}]`);
      readyCount++;
    } else {
      console.log(`❌  ${label}  [${ref}]`);
      issues.forEach((i) => console.log(`      ⚠️  ${i}`));
      issueCount++;
    }
  }

  console.log("\n" + "─".repeat(80));
  console.log(`\nSummary:`);
  console.log(`  ✅  Ready for month-end billing: ${readyCount}`);
  console.log(`  ❌  Issues: ${issueCount}`);
  if (issueCount === 0) {
    console.log(`\n🎉  All imported sessions will be included in the next billing run.\n`);
  } else {
    console.log(`\n⚠️  Fix the issues above before month-end.\n`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
