import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ["completed", "no_show"] },
      date: { gte: new Date("2026-03-01"), lte: new Date("2026-03-31") },
    },
    include: { student: { select: { firstName: true, lastName: true, billingType: true } } },
  });

  const unbilled = bookings.filter((b) => !b.invoiceId && !b.paymentRequestId);
  const billed   = bookings.filter((b) => b.invoiceId || b.paymentRequestId);

  const sum = (arr: typeof bookings) => arr.reduce((s, b) => s + (b.priceZarCents ?? 0), 0);

  console.log("\n── March 2026 Revenue Summary ─────────────────────────────────────────");
  console.log(`Total completed sessions : ${bookings.length}`);
  console.log(`  Already billed/invoiced: ${billed.length}   → R${(sum(billed) / 100).toFixed(2)}`);
  console.log(`  Unbilled (postpaid pool): ${unbilled.length}  → R${(sum(unbilled) / 100).toFixed(2)}`);
  console.log(`  TOTAL EXPECTED REVENUE : R${(sum(bookings) / 100).toFixed(2)}`);

  // Sage-imported subset
  const sageBookings = bookings.filter((b) => b.adminNotes?.includes("Sage ref:"));
  console.log(`\n── Sage-imported subset ────────────────────────────────────────────────`);
  console.log(`  Sessions: ${sageBookings.length}  → R${(sum(sageBookings) / 100).toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
