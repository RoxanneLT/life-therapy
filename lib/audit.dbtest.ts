import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

after(() => prisma.$disconnect());

// audit_logs is append-only in the database (prisma/sql/80_ops.sql, owner's ruling 2026-10-09):
// a row can be written and never rewritten, removed or truncated, by any role the app holds.

test("a row is written, and can be neither changed nor removed", async () => {
  const entityId = `dbtest-${randomUUID()}`;
  await recordAudit({ action: "dbtest_append_only", entityType: "test", entityId, actorEmail: "admin@example.test" });
  const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId } });

  await assert.rejects(prisma.auditLog.update({ where: { id: row.id }, data: { action: "rewritten" } }), /append-only/);
  await assert.rejects(prisma.auditLog.deleteMany({ where: { entityId } }), /append-only/);
  await assert.rejects(prisma.$executeRawUnsafe(`TRUNCATE "audit_logs"`), /append-only/);

  assert.equal((await prisma.auditLog.findFirstOrThrow({ where: { entityId } })).action, "dbtest_append_only");
});

test("a client's contact details are masked; an admin account's are kept", async () => {
  const entityId = `dbtest-${randomUUID()}`;
  await recordAudit({
    action: "dbtest_mask",
    entityType: "student",
    entityId,
    actorEmail: "admin@example.test",
    before: { email: "jane.doe@example.test", clientName: "Jane van Doe", phone: "+27 82 555 0123", status: "active" },
    after: { billingEmail: "", couplesPartnerName: null },
    metadata: { recipientEmail: "pay@example.test", fields: { firstName: { stored: "Jane", incoming: "Janet" } } },
  });
  const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId } });
  assert.deepEqual(row.before, { email: "j***@example.test", clientName: "J. V. D.", phone: "***23", status: "active" });
  assert.deepEqual(row.after, { billingEmail: "", couplesPartnerName: null });
  // Top level only: a contact conflict nests names under `fields` so an admin can apply them.
  assert.deepEqual(row.metadata, { recipientEmail: "p***@example.test", fields: { firstName: { stored: "Jane", incoming: "Janet" } } });

  const adminId = `dbtest-${randomUUID()}`;
  await recordAudit({ action: "dbtest_mask", entityType: "admin_user", entityId: adminId, actorEmail: "admin@example.test", after: { email: "new.admin@example.test" } });
  assert.deepEqual((await prisma.auditLog.findFirstOrThrow({ where: { entityId: adminId } })).after, { email: "new.admin@example.test" });
});

test("a write that fails leaves a failed cron_runs row for the digest, without the values", async () => {
  const entityId = `dbtest-${randomUUID()}`;
  // A required column left null: the audit write itself is refused.
  await recordAudit({ action: "dbtest_gap", entityType: "test", entityId, actorEmail: null as unknown as string, after: { secretish: "value" } });

  assert.equal(await prisma.auditLog.count({ where: { entityId } }), 0);
  const gap = await prisma.cronRun.findFirstOrThrow({ where: { jobName: "audit-write", errorMessage: { contains: entityId } } });
  assert.equal(gap.status, "failed");
  assert.ok(gap.finishedAt);
  assert.match(gap.errorMessage ?? "", /^dbtest_gap on test /);
  assert.doesNotMatch(gap.errorMessage ?? "", /secretish/);
});
