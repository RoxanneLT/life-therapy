/**
 * Imported FIRST by every *.dbtest.ts, before anything that reaches `@/lib/prisma`.
 *
 * The prisma singleton reads DATABASE_URL when it is first imported and has no injection seam. It
 * connects lazily, on the first query, so a throw at this module's evaluation stops the test file
 * before any query can run. ESM evaluates this file's own imports first; that is safe for the same
 * reason. `npm run test:db`
 * sets LT_DB_TEST and points DATABASE_URL at a localhost database it has just built. Anything else,
 * such as `tsx --test` run by hand in a shell holding the production URL, stops here before a single
 * row is written.
 */
import { randomUUID } from "node:crypto";
import { calendarDate, saToday } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function assertTestDatabase(): void {
  const raw = process.env.DATABASE_URL;
  if (process.env.LT_DB_TEST !== "1" || !raw) {
    throw new Error("database tests run through `npm run test:db`, which builds the database they need");
  }
  const host = new URL(raw).hostname;
  if (!LOCAL_HOSTS.has(host)) throw new Error(`refusing to run database tests against ${host}: localhost only`);
}

assertTestDatabase();

/** A unique address per call, so concurrent test files never touch each other's rows. */
export const testEmail = (label: string): string => `dbtest-${label}-${randomUUID().slice(0, 8)}@example.test`;

export function makeStudent(label: string, data: { billingType?: "prepaid" | "postpaid"; billFullMonth?: boolean } = {}) {
  return prisma.student.create({ data: { email: testEmail(label), firstName: "Db", lastName: "Test", ...data } });
}

export function makeBooking(
  studentId: string,
  data: { date?: string; status?: "pending" | "confirmed" | "completed" | "cancelled" | "no_show"; priceZarCents?: number; priceCurrency?: string } = {},
) {
  const { date, ...rest } = data;
  return prisma.booking.create({
    data: {
      studentId,
      sessionType: "individual",
      date: calendarDate(date ?? saToday()),
      startTime: "09:00",
      endTime: "10:00",
      durationMinutes: 60,
      clientName: "Db Test",
      clientEmail: "client@example.test",
      ...rest,
    },
  });
}
