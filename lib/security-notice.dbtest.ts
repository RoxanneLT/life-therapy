import { makeStudent, testEmail } from "@/test/db/harness";
import { after, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";

/**
 * Who is told when an account's access changes, against a real database. Supabase Auth and the
 * mail send are stood in: what is asserted is the audit row this project writes and the notice it
 * asks for (scripts/db-test.mjs passes --experimental-test-module-mocks).
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "dbtest";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "dbtest";

const ADMIN = { id: `admin-${randomUUID()}`, email: "dbtest-admin@example.test", name: "Db Admin", role: "super_admin" };
const AUTH_USER = { id: `auth-${randomUUID()}` };
const lib = (p: string) => pathToFileURL(join(process.cwd(), p)).href;

let factors: { id: string; status: string }[] = [];
const notices: { to: string; message: string }[] = [];

mock.module(lib("lib/auth.ts"), {
  namedExports: {
    requireRole: async () => ({ adminUser: ADMIN, user: AUTH_USER }),
    getAuthenticatedAdmin: async () => ({ adminUser: ADMIN, user: AUTH_USER }),
  },
});
mock.module("next/cache", { namedExports: { revalidatePath: () => {}, revalidateTag: () => {} } });
mock.module(lib("lib/supabase-admin.ts"), {
  namedExports: {
    supabaseAdmin: {
      auth: {
        admin: {
          listUsers: async () => ({ data: { users: [] }, error: null }),
          updateUserById: async () => ({ data: {}, error: null }),
          mfa: { listFactors: async () => ({ data: { factors }, error: null }) },
        },
      },
    },
  },
});
mock.module(lib("lib/security-notice.ts"), {
  namedExports: {
    sendSecurityNotice: async (to: string, _name: string, message: string) => {
      notices.push({ to, message });
    },
  },
});

const clientActions = () => import("@/app/(admin)/admin/(dashboard)/clients/[id]/actions");
const mfaActions = () => import("@/app/(public)/login/mfa/actions");

beforeEach(() => {
  notices.length = 0;
  factors = [];
});
after(() => prisma.$disconnect());

test("moving a client's login tells the OLD address, naming the new one", async () => {
  const { updateClientEmailAction } = await clientActions();
  const s = await makeStudent("email-move");
  await prisma.student.update({ where: { id: s.id }, data: { supabaseUserId: `auth-${randomUUID()}` } });
  const next = testEmail("email-moved");

  assert.deepEqual(await updateClientEmailAction(s.id, next), { success: true });

  assert.equal(notices.length, 1);
  assert.equal(notices[0].to, s.email);
  assert.match(notices[0].message, new RegExp(next.replace(/[.+]/g, "\\$&")));
});

test("a client with no login is not sent a sign-in notice", async () => {
  const { updateClientEmailAction } = await clientActions();
  const s = await makeStudent("email-nologin");

  assert.deepEqual(await updateClientEmailAction(s.id, testEmail("email-nologin-new")), { success: true });
  assert.equal(notices.length, 0);
});

test("an admin's own new authenticator is audited and the owner told", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  factors = [{ id: "f1", status: "verified" }];

  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});

  assert.equal(await prisma.auditLog.count({ where: { action: "admin_mfa_enrolled", entityId: ADMIN.id } }), 1);
  assert.deepEqual(notices.map((n) => n.to), [ADMIN.email]);
});

test("an 'added' claim with no verified factor records and sends nothing", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  factors = [{ id: "f2", status: "unverified" }];
  const before = await prisma.auditLog.count({ where: { action: "admin_mfa_enrolled", entityId: ADMIN.id } });

  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});

  assert.equal(await prisma.auditLog.count({ where: { action: "admin_mfa_enrolled", entityId: ADMIN.id } }), before);
  assert.equal(notices.length, 0);
});

test("removing one's own second factor is audited and the owner told", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();

  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await prisma.auditLog.count({ where: { action: "admin_mfa_self_removed", entityId: ADMIN.id } }), 1);
  assert.deepEqual(notices.map((n) => n.to), [ADMIN.email]);
});
