import "@/test/db/harness";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { collectStuckCronRuns, withCronRun } from "@/lib/cron/with-cron-run";

const SECRET = "dbtest-cron-secret";
let saved: string | undefined;
before(() => {
  saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = SECRET;
});
after(async () => {
  if (saved === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = saved;
  await prisma.$disconnect();
});

const req = () => new NextRequest("https://example.test/api/cron/x", { headers: { "x-cron-secret": SECRET } });

// The cronRun write is best-effort: a failure is swallowed so it can never mask the job's own
// response. That makes a broken table invisible over HTTP, so these assert the ROW.
test("a successful run records one completed row with its numeric fields as metadata", async () => {
  const job = `dbtest-ok-${randomUUID().slice(0, 8)}`;
  const res = await withCronRun(job, async () => Response.json({ ok: true, sent: 4, note: "x" }))(req());
  assert.equal(res.status, 200);
  const rows = await prisma.cronRun.findMany({ where: { jobName: job } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "completed");
  assert.deepEqual(rows[0].metadata, { sent: 4 });
  assert.ok(rows[0].finishedAt);
});

test("a handler that throws records a failed row with the message", async () => {
  const job = `dbtest-throw-${randomUUID().slice(0, 8)}`;
  const res = await withCronRun(job, async () => {
    throw new Error("graph timed out");
  })(req());
  assert.equal(res.status, 500);
  const [row] = await prisma.cronRun.findMany({ where: { jobName: job } });
  assert.equal(row?.status, "failed");
  assert.equal(row?.errorMessage, "graph timed out");
});

test("an unauthorised request records nothing", async () => {
  const job = `dbtest-401-${randomUUID().slice(0, 8)}`;
  const bad = new NextRequest("https://example.test/api/cron/x", { headers: { "x-cron-secret": "wrong-secret-value" } });
  const res = await withCronRun(job, async () => Response.json({ ok: true }))(bad);
  assert.equal(res.status, 401);
  assert.equal(await prisma.cronRun.count({ where: { jobName: job } }), 0);
});

test("collectStuckCronRuns finds a run left 'running' past the cutoff, and not a recent one", async () => {
  const old = `dbtest-stuck-${randomUUID().slice(0, 8)}`;
  const fresh = `dbtest-fresh-${randomUUID().slice(0, 8)}`;
  await prisma.cronRun.create({ data: { jobName: old, status: "running", startedAt: new Date(Date.now() - 2 * 3_600_000) } });
  await prisma.cronRun.create({ data: { jobName: fresh, status: "running", startedAt: new Date() } });
  const stuck = JSON.stringify(await collectStuckCronRuns(30));
  assert.ok(stuck.includes(old), stuck);
  assert.ok(!stuck.includes(fresh), stuck);
});
