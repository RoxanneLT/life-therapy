import { makeBooking, makeStudent } from "@/test/db/harness";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { calendarDate } from "@/lib/dates";
import { generateMonthlyPaymentRequests } from "@/lib/generate-payment-requests";

after(() => prisma.$disconnect());

// Bills every postpaid student in the database. Only this file creates postpaid students, and its
// assertions still read its own student's rows. The runner pins TZ=UTC: the run reads the billing
// month with getFullYear()/getMonth() (host-local), so a mid-month date keeps that unambiguous.
const BILLING_DATE = calendarDate("2026-03-15");

test("a completed session is billed once, linked to its request, and a re-run bills nothing new", async () => {
  const s = await makeStudent("postpaid", { billingType: "postpaid", billFullMonth: false });
  const done = await makeBooking(s.id, { date: "2026-01-20", status: "completed", priceZarCents: 85_000, priceCurrency: "ZAR" });
  const pending = await makeBooking(s.id, { date: "2026-01-22", status: "pending", priceZarCents: 85_000, priceCurrency: "ZAR" });

  await generateMonthlyPaymentRequests(BILLING_DATE);

  const requests = await prisma.paymentRequest.findMany({ where: { studentId: s.id } });
  assert.equal(requests.length, 1);
  const [pr] = requests;
  assert.equal(pr.currency, "ZAR");
  assert.equal(pr.subtotalCents, 85_000);
  // No SiteSetting row, so the code's defaults apply: not VAT-registered, nothing added.
  assert.equal(pr.totalCents, 85_000);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: done.id } })).paymentRequestId, pr.id);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: pending.id } })).paymentRequestId, null, "an unfinished session is not billed");

  await generateMonthlyPaymentRequests(BILLING_DATE);
  assert.equal(await prisma.paymentRequest.count({ where: { studentId: s.id } }), 1);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: done.id } })).paymentRequestId, pr.id);
});

test("a session priced in EUR is billed in EUR, with no VAT", async () => {
  const s = await makeStudent("eur", { billingType: "postpaid", billFullMonth: false });
  await makeBooking(s.id, { date: "2026-01-21", status: "completed", priceZarCents: 9_000, priceCurrency: "EUR" });

  await generateMonthlyPaymentRequests(BILLING_DATE);

  const [pr] = await prisma.paymentRequest.findMany({ where: { studentId: s.id } });
  assert.equal(pr?.currency, "EUR");
  assert.equal(pr?.vatAmountCents, 0);
  assert.equal(pr?.totalCents, 9_000);
});
