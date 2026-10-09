import { makeBooking, makeStudent } from "@/test/db/harness";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { addSaDays, calendarDate, saDateStr, saToday } from "@/lib/dates";
import { eraseClient } from "@/lib/popia/erase-client";
import { purgeRetainedClinicalRecords } from "@/lib/popia/purge-retained";
import { erasedEmail } from "@/lib/popia/plan";
import { externalHolders } from "@/lib/popia/external-holders";

after(() => prisma.$disconnect());

// The owner's rulings (lib/popia/plan.ts): identity goes at once, money stays as issued, clinical
// content stays anonymised until five years after the last session, and the erased client's name
// leaves other clients' couples bookings too.

async function clientWithHistory(label: string) {
  const student = await makeStudent(label);
  await prisma.student.update({ where: { id: student.id }, data: { phone: "+27820000000", adminNotes: "private", dateOfBirth: calendarDate("1990-01-01") } });
  await prisma.clientIntake.create({ data: { studentId: student.id, feelings: ["anxious"], additionalNotes: "clinical" } });
  const past = await makeBooking(student.id, { date: addSaDays(saToday(), -30), status: "completed", priceZarCents: 85000 });
  await prisma.booking.update({ where: { id: past.id }, data: { clientEmail: student.email, sessionNotes: "session content", clientPhone: "+27820000000" } });
  await prisma.sessionCreditTransaction.create({ data: { studentId: student.id, type: "purchase", amount: 1, balanceAfter: 1, description: "Pack" } });
  return { student, past };
}

test("identity goes, money stays, clinical content is kept until five years after the last session", async () => {
  const { student, past } = await clientWithHistory("erase");
  const res = await eraseClient(student.id, "admin@example.test");
  assert.equal(res.success, true);

  const after = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
  assert.equal(after.email, erasedEmail(student.id));
  assert.equal(after.firstName, "Erased");
  assert.equal(after.phone, null);
  assert.equal(after.dateOfBirth, null);
  assert.equal(after.clientStatus, "archived");
  assert.equal(after.emailOptOut, true);
  assert.equal(after.erasedBy, "admin@example.test");
  assert.ok(after.erasedAt);
  const [y, m, d] = saDateStr(past.date).split("-");
  assert.equal(after.retainUntil && saDateStr(after.retainUntil), `${Number(y) + 5}-${m}-${d}`);
  assert.equal(after.adminNotes, "private", "clinical: kept until retainUntil");

  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: past.id } });
  assert.equal(booking.clientEmail, erasedEmail(student.id));
  assert.equal(booking.clientPhone, null);
  assert.equal(booking.priceZarCents, 85000, "the billed price stays");
  assert.equal(booking.sessionNotes, "session content", "clinical: kept until retainUntil");
  assert.ok(await prisma.clientIntake.findUnique({ where: { studentId: student.id } }));
  assert.equal(await prisma.sessionCreditTransaction.count({ where: { studentId: student.id } }), 1, "the ledger stays");

  const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "client_erased", entityId: student.id } });
  assert.ok(!JSON.stringify(audit).includes(student.email), "the audit row carries no address");

  assert.deepEqual(await eraseClient(student.id, "admin@example.test"), { success: false, error: "This client has already been erased." });
});

test("after the erase, what outside services hold can still be listed, and the address is returned once", async () => {
  const { student, past } = await clientWithHistory("external");
  await prisma.booking.update({ where: { id: past.id }, data: { graphEventId: `evt-${student.id}` } });
  await prisma.paymentRequest.create({
    data: { studentId: student.id, billingMonth: "2026-01", status: "paid", paystackReference: `ps-${student.id}`, lineItems: [], subtotalCents: 0, totalCents: 0, dueDate: calendarDate("2026-01-31"), periodStart: calendarDate("2026-01-01"), periodEnd: calendarDate("2026-01-31") },
  });
  await prisma.emailLog.create({ data: { to: student.email, subject: "Hi", status: "sent", studentId: student.id } });

  const res = await eraseClient(student.id, "admin@example.test");
  assert.equal(res.success && res.contactEmail, student.email);

  assert.deepEqual(await externalHolders(student.id), {
    paystackReferences: [`ps-${student.id}`],
    calendarEvents: 1,
    emailsSent: 1,
    whatsappMessages: 0,
  });
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "client_erased", entityId: student.id } });
  assert.equal((audit.metadata as Record<string, unknown>).externalCleanup, "pending");
});

test("the purge removes the kept clinical content once the window has closed", async () => {
  const { student, past } = await clientWithHistory("purge");
  await eraseClient(student.id, "admin@example.test");
  await prisma.student.update({ where: { id: student.id }, data: { retainUntil: calendarDate(addSaDays(saToday(), -1)) } });

  const { purged } = await purgeRetainedClinicalRecords();
  assert.ok(purged >= 1);
  assert.equal(await prisma.clientIntake.findUnique({ where: { studentId: student.id } }), null);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: past.id } })).sessionNotes, null);
  const s = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
  assert.equal(s.adminNotes, null);
  assert.equal(s.retainUntil, null);
});

test("a client with no sessions has nothing to retain, so clinical content goes at once", async () => {
  const student = await makeStudent("nosessions");
  await prisma.clientIntake.create({ data: { studentId: student.id, feelings: ["sad"] } });
  const res = await eraseClient(student.id, "admin@example.test");
  assert.deepEqual(res, { success: true, retainUntil: null, contactEmail: student.email });
  assert.equal(await prisma.clientIntake.findUnique({ where: { studentId: student.id } }), null);
});

test("walk-in bookings under the address are anonymised, and the name leaves a partner's couples booking", async () => {
  const student = await makeStudent("walkin");
  const walkIn = await prisma.booking.update({
    where: { id: (await makeBooking(student.id, { date: addSaDays(saToday(), -10), status: "completed" })).id },
    data: { studentId: null, clientEmail: student.email.toUpperCase(), clientName: "Walk In" },
  });
  const partner = await makeStudent("partner");
  const couples = await prisma.booking.update({
    where: { id: (await makeBooking(partner.id, { date: addSaDays(saToday(), -5), status: "completed" })).id },
    data: { couplesPartnerName: "Walk In", couplesPartnerEmail: student.email },
  });

  await eraseClient(student.id, "admin@example.test");
  const w = await prisma.booking.findUniqueOrThrow({ where: { id: walkIn.id } });
  assert.equal(w.clientEmail, erasedEmail(student.id));
  assert.equal(w.studentId, student.id, "linked, so the purge reaches it");
  const c = await prisma.booking.findUniqueOrThrow({ where: { id: couples.id } });
  assert.equal(c.couplesPartnerEmail, null);
  assert.equal(c.couplesPartnerName, null);
  assert.equal(c.studentId, partner.id, "the partner's own booking is otherwise untouched");
});

test("refuses while an upcoming session would be left half-done, and changes nothing", async () => {
  const student = await makeStudent("upcoming");
  await makeBooking(student.id, { date: addSaDays(saToday(), 3), status: "confirmed" });
  const res = await eraseClient(student.id, "admin@example.test");
  assert.equal(res.success, false);
  assert.match(!res.success ? res.error : "", /upcoming session/);
  const untouched = await prisma.student.findUniqueOrThrow({ where: { id: student.id } });
  assert.equal(untouched.erasedAt, null);
  assert.notEqual(untouched.email, erasedEmail(student.id));
});
