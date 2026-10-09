import { makeStudent } from "@/test/db/harness";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { processCreditExpiry } from "@/lib/cron/credit-expiry";

after(() => prisma.$disconnect());

const DAY = 86_400_000;

// processCreditExpiry reads the clock itself and scans every balance in the database. So every
// fixture here is either already lapsed or more than 14 days out: a balance 1–14 days from expiry
// would take the warning path and attempt a real email send. Assertions read this file's own rows,
// never the run's totals alone, because other test files may hold balances too.
async function balance(label: string, credits: number, expiresAt: Date | null) {
  const s = await makeStudent(label);
  await prisma.sessionCreditBalance.create({ data: { studentId: s.id, balance: credits, expiresAt } });
  return s.id;
}

test("a lapsed balance is forfeited in one transaction; future and undated balances are left alone", async () => {
  const lapsed = await balance("lapsed", 2, new Date(Date.now() - 2 * DAY));
  const future = await balance("future", 2, new Date(Date.now() + 60 * DAY));
  const undated = await balance("undated", 2, null);

  const result = await processCreditExpiry();
  assert.equal(result.failures, 0);
  assert.ok(result.expired >= 1 && result.creditsForfeited >= 2, JSON.stringify(result));

  const after = await prisma.sessionCreditBalance.findUniqueOrThrow({ where: { studentId: lapsed } });
  assert.equal(after.balance, 0);
  assert.equal(after.expiresAt, null, "expiresAt is cleared with the balance, or the row is re-selected every night");
  const rows = await prisma.sessionCreditTransaction.findMany({ where: { studentId: lapsed } });
  assert.deepEqual(rows.map((r) => [r.type, r.amount, r.balanceAfter]), [["expired", 2, 0]]);

  for (const id of [future, undated]) {
    assert.equal((await prisma.sessionCreditBalance.findUniqueOrThrow({ where: { studentId: id } })).balance, 2);
    assert.equal(await prisma.sessionCreditTransaction.count({ where: { studentId: id } }), 0);
  }
});

test("a second run forfeits nothing more for the same balance", async () => {
  const lapsed = await balance("rerun", 1, new Date(Date.now() - 2 * DAY));
  await processCreditExpiry();
  await processCreditExpiry();
  assert.equal(await prisma.sessionCreditTransaction.count({ where: { studentId: lapsed, type: "expired" } }), 1);
});
