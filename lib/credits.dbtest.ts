import { makeStudent } from "@/test/db/harness";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { addCredits, deductCredit, forfeitCredit, getBalance, refundCredit } from "@/lib/credits";

after(() => prisma.$disconnect());

const ledger = async (studentId: string) =>
  (await prisma.sessionCreditTransaction.findMany({ where: { studentId }, orderBy: { createdAt: "asc" } })).map((r) => ({
    type: r.type,
    amount: r.amount,
    balanceAfter: r.balanceAfter,
    bookingId: r.bookingId,
  }));

test("addCredits creates the balance, then increments it, with one purchase row each", async () => {
  const s = await makeStudent("add");
  assert.equal(await addCredits(s.id, 3, "pack of 3"), 3);
  assert.equal(await addCredits(s.id, 2, "pack of 2"), 5);
  assert.equal(await getBalance(s.id), 5);
  assert.deepEqual(await ledger(s.id), [
    { type: "purchase", amount: 3, balanceAfter: 3, bookingId: null },
    { type: "purchase", amount: 2, balanceAfter: 5, bookingId: null },
  ]);
});

// The property a mock cannot test: the `balance >= 1` claim is one UPDATE, so five racing deducts
// against one credit across separate pool connections must produce exactly one session, not five.
test("five concurrent deducts against one credit: exactly one succeeds", async () => {
  const s = await makeStudent("race");
  await addCredits(s.id, 1, "one credit");
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => deductCredit(s.id, randomUUID(), "race")));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  for (const r of results) if (r.status === "rejected") assert.match(String(r.reason), /Insufficient session credits/);
  assert.equal(await getBalance(s.id), 0);
  assert.equal((await ledger(s.id)).filter((r) => r.type === "used").length, 1);
});

test("deductCredit refuses a student with no balance row, and writes nothing", async () => {
  const s = await makeStudent("none");
  await assert.rejects(deductCredit(s.id, randomUUID(), "nothing to spend"), /Insufficient session credits/);
  assert.deepEqual(await ledger(s.id), []);
});

test("deductCredit given a transaction handle rolls back with that transaction", async () => {
  const s = await makeStudent("tx");
  await addCredits(s.id, 1, "one credit");
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await deductCredit(s.id, randomUUID(), "inside tx", tx);
      throw new Error("booking failed after the deduct");
    }),
    /booking failed after the deduct/,
  );
  assert.equal(await getBalance(s.id), 1);
  assert.equal((await ledger(s.id)).filter((r) => r.type === "used").length, 0);
});

test("refundCredit returns the credit and records it against the booking", async () => {
  const s = await makeStudent("refund");
  const bookingId = randomUUID();
  await addCredits(s.id, 1, "one credit");
  await deductCredit(s.id, bookingId, "used");
  await refundCredit(s.id, bookingId, "cancelled in time");
  assert.equal(await getBalance(s.id), 1);
  const refund = (await ledger(s.id)).at(-1);
  assert.deepEqual(refund, { type: "refund", amount: 1, balanceAfter: 1, bookingId });
});

// By design (lib/credits.ts): a forfeit records the late cancellation and leaves the balance alone,
// because the credit was already spent when the session was booked. Pinned, not "fixed".
test("forfeitCredit writes a zero-amount used row and leaves the balance untouched", async () => {
  const s = await makeStudent("forfeit");
  const bookingId = randomUUID();
  await addCredits(s.id, 2, "two credits");
  await forfeitCredit(s.id, bookingId, "late cancel");
  assert.equal(await getBalance(s.id), 2);
  const row = (await ledger(s.id)).at(-1);
  assert.equal(row?.type, "used");
  assert.equal(row?.amount, 0);
  assert.equal(row?.bookingId, bookingId);
});
