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

// A fresh admin per test (beforeEach), so the dedupes never read another test's audit rows.
const newAdmin = () => ({ id: `admin-${randomUUID()}`, email: "dbtest-admin@example.test", name: "Db Admin", role: "super_admin" });
let ADMIN = newAdmin();
const AUTH_USER = { id: `auth-${randomUUID()}` };
const lib = (p: string) => pathToFileURL(join(process.cwd(), p)).href;

type FakeFactor = { id: string; status: string; created_at: string; updated_at: string };
let factors: FakeFactor[] = [];
let aalLevel: string | null = "aal2";
let failingDeletes = new Set<string>();
// When the session's access token was issued. Default: signed in ten minutes ago.
let tokenIssuedMs = Date.now() - 10 * 60 * 1000;
let tokenOverride: string | undefined | null = null; // null: build one from tokenIssuedMs
const fakeToken = (issuedMs: number) =>
  tokenOverride !== null ? tokenOverride :
  ["{}", JSON.stringify({ iat: Math.floor(issuedMs / 1000), aal: aalLevel })].map((p) => Buffer.from(p).toString("base64url")).join(".") + ".sig";
const factor = (id: string, status: string, agoMs = 0): FakeFactor => {
  const at = new Date(Date.now() - agoMs).toISOString();
  return { id, status, created_at: at, updated_at: at };
};
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
          mfa: {
            listFactors: async () => ({ data: { factors }, error: null }),
            deleteFactor: async ({ id }: { id: string }) =>
              failingDeletes.has(id) ? { data: null, error: { message: "upstream refused" } } : { data: { id }, error: null },
          },
        },
      },
    },
    verifyPassword: async () => true,
  },
});
mock.module(lib("lib/mfa-step-up.ts"), {
  namedExports: {
    confirmWithTotp: async () => ({}),
    stepUpWithTotp: async () => ({}),
    verifiedTotpFactor: async () => null,
    recoveryLinkMfaHint: async () => "",
  },
});
mock.module(lib("lib/supabase-server.ts"), {
  namedExports: {
    createSupabaseServerClient: async () => ({
      auth: {
        mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: aalLevel, nextLevel: aalLevel }, error: null }) },
        getSession: async () => ({ data: { session: { access_token: fakeToken(tokenIssuedMs) } }, error: null }),
      },
    }),
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
const userActions = () => import("@/app/(admin)/admin/(dashboard)/users/actions");

async function makeTargetAdmin() {
  const tag = randomUUID();
  return prisma.adminUser.create({
    data: { supabaseUserId: `auth-${tag}`, email: testEmail(`target-${tag.slice(0, 8)}`), name: "Target", role: "editor" },
  });
}

test("a super admin's reset whose delete fails says so, and tells the target nothing", async () => {
  const { removeUserMfaAction } = await userActions();
  const target = await makeTargetAdmin();
  factors = [factor("t1", "verified")];
  failingDeletes = new Set(["t1"]);

  const result = await removeUserMfaAction(target.id, "123456");

  assert.match(result.error ?? "", /could not be fully removed/);
  assert.equal(await prisma.auditLog.count({ where: { action: "admin_mfa_removed", entityId: target.id } }), 0);
  assert.equal(notices.length, 0);
});

test("a reset of an admin with no factor does nothing and says so", async () => {
  const { removeUserMfaAction } = await userActions();
  const target = await makeTargetAdmin();

  assert.match((await removeUserMfaAction(target.id, "123456")).error ?? "", /nothing to remove/);
  assert.equal(await prisma.auditLog.count({ where: { entityId: target.id } }), 0);
  assert.equal(notices.length, 0);
});

test("a partial reset: what went is recorded, and the target is told only if no verified factor survived", async () => {
  const { removeUserMfaAction } = await userActions();
  const removedRow = (id: string) => prisma.auditLog.findFirst({ where: { action: "admin_mfa_removed", entityId: id } });

  // The verified factor went and only a stale unverified one survived: password-only now, so told.
  const a = await makeTargetAdmin();
  factors = [factor("pa-v", "verified"), factor("pa-u", "unverified")];
  failingDeletes = new Set(["pa-u"]);
  assert.match((await removeUserMfaAction(a.id, "123456")).error ?? "", /could not be fully removed/);
  assert.deepEqual((await removedRow(a.id))?.metadata, { targetEmail: a.email, factorsRemoved: 1, factorsFailed: 1 });
  assert.deepEqual(notices.map((n) => n.to), [a.email]);

  // A verified factor survived: still protected, so not told.
  notices.length = 0;
  const b = await makeTargetAdmin();
  factors = [factor("pb-u", "unverified"), factor("pb-v", "verified")];
  failingDeletes = new Set(["pb-v"]);
  assert.match((await removeUserMfaAction(b.id, "123456")).error ?? "", /could not be fully removed/);
  assert.ok(await removedRow(b.id));
  assert.equal(notices.length, 0);
});

test("a reset that clears only unverified factors is recorded but tells the target nothing", async () => {
  const { removeUserMfaAction } = await userActions();
  const target = await makeTargetAdmin();
  factors = [factor("u-only", "unverified")];

  assert.deepEqual(await removeUserMfaAction(target.id, "123456"), { success: true });

  assert.equal(await prisma.auditLog.count({ where: { action: "admin_mfa_removed", entityId: target.id } }), 1);
  assert.equal(notices.length, 0);
});

test("a super admin's reset that deletes every factor is recorded and the target told", async () => {
  const { removeUserMfaAction } = await userActions();
  const target = await makeTargetAdmin();
  factors = [factor("t2", "verified")];

  assert.deepEqual(await removeUserMfaAction(target.id, "123456"), { success: true });

  assert.equal(await prisma.auditLog.count({ where: { action: "admin_mfa_removed", entityId: target.id } }), 1);
  assert.deepEqual(notices.map((n) => n.to), [target.email]);
});

beforeEach(() => {
  notices.length = 0;
  factors = [];
  aalLevel = "aal2";
  ADMIN = newAdmin();
  tokenIssuedMs = Date.now() - 10 * 60 * 1000;
  tokenOverride = null;
  failingDeletes = new Set();
});
const countFor = (action: string) => prisma.auditLog.count({ where: { action, entityId: ADMIN.id } });
const DAY = 24 * 60 * 60 * 1000;
const priorRow = (action: string, agoMs: number) =>
  prisma.auditLog.create({
    data: { action, entityType: "admin_user", entityId: ADMIN.id, actorEmail: "someone@example.test", createdAt: new Date(Date.now() - agoMs) },
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

test("an admin's own new authenticator is audited and the owner told, once", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  factors = [factor("f1", "verified")];
  aalLevel = "aal1"; // the browser's upgrade may not have reached the cookies yet
  const before = await countFor("admin_mfa_enrolled");

  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});
  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});

  assert.equal(await countFor("admin_mfa_enrolled"), before + 1);
  assert.deepEqual(notices.map((n) => n.to), [ADMIN.email]);
});

test("an 'added' claim over an old factor (password only, factor already there) records nothing", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  factors = [factor("f-old", "verified", 2 * DAY)];
  aalLevel = "aal1";
  const before = await countFor("admin_mfa_enrolled");

  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});

  assert.equal(await countFor("admin_mfa_enrolled"), before);
  assert.equal(notices.length, 0);
});

test("an 'added' claim with no verified factor records and sends nothing", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  factors = [factor("f2", "unverified")];
  const before = await countFor("admin_mfa_enrolled");

  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});

  assert.equal(await countFor("admin_mfa_enrolled"), before);
  assert.equal(notices.length, 0);
});

test("removing one's own second factor is audited and the owner told", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  const before = await countFor("admin_mfa_self_removed");

  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await countFor("admin_mfa_self_removed"), before + 1);
  assert.deepEqual(notices.map((n) => n.to), [ADMIN.email]);
});

test("a removal is recorded once, and again only after a fresh enrolment", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();

  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});
  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {}); // the token still reads aal2
  assert.equal(await countFor("admin_mfa_self_removed"), 1);

  factors = [factor("f4", "verified")];
  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});
  tokenIssuedMs = Date.now() + 1000; // the re-enrolment's verify issued a new token
  factors = [];
  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await countFor("admin_mfa_self_removed"), 2);
});

test("a token that outlived a removal by days still cannot record it twice (any JWT expiry)", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  tokenIssuedMs = Date.now() - 3 * DAY;
  await priorRow("admin_mfa_self_removed", 2 * DAY);

  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await countFor("admin_mfa_self_removed"), 1);
  assert.equal(notices.length, 0);
});

test("a re-enrolment whose 'added' row was missed does not hide the next real removal", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  await priorRow("admin_mfa_self_removed", 20 * 60 * 1000); // removed, then re-enrolled with no row
  // tokenIssuedMs: ten minutes ago, the re-enrolment's verify

  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await countFor("admin_mfa_self_removed"), 2);
});

test("a token whose issue time cannot be read records nothing (never a row that might be misattributed)", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  const noIat = ["{}", JSON.stringify({ aal: "aal2", iat: "yesterday" })].map((p) => Buffer.from(p).toString("base64url")).join(".");
  for (const token of [undefined, "not-a-jwt", `${noIat}.sig`]) {
    tokenOverride = token;
    assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});
  }

  assert.equal(await countFor("admin_mfa_self_removed"), 0);
  assert.equal(notices.length, 0);
});

test("an enrolment's window edge: a factor created 23 hours ago counts, 25 hours ago does not", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  aalLevel = "aal1";
  factors = [factor("f-25h", "verified", 25 * 60 * 60 * 1000)];
  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});
  assert.equal(await countFor("admin_mfa_enrolled"), 0);

  factors = [factor("f-23h", "verified", 23 * 60 * 60 * 1000)];
  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});
  assert.equal(await countFor("admin_mfa_enrolled"), 1);
});

test("a super admin's reset after the target's token was issued: that session cannot also claim it", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  await priorRow("admin_mfa_removed", 5 * 60 * 1000);

  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await countFor("admin_mfa_self_removed"), 0);
  assert.equal(notices.length, 0);
});

test("an old removal with no enrolment row after it (a missed add) does not hide a real removal", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  await priorRow("admin_mfa_removed", 2 * DAY); // reset, then re-enrolled with no row: before this feature, or a missed call

  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await countFor("admin_mfa_self_removed"), 1);
  assert.deepEqual(notices.map((n) => n.to), [ADMIN.email]);
});

test("an enrolment confirmed hours after the QR was shown is still recorded", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  factors = [factor("f-slow", "verified", 3 * 60 * 60 * 1000)];
  aalLevel = "aal1";

  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});

  assert.equal(await countFor("admin_mfa_enrolled"), 1);
});

test("challenging an old factor (allowed at AAL1) does not make it read as newly added", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  const old = factor("f-challenged", "verified", 2 * DAY);
  factors = [{ ...old, updated_at: new Date().toISOString() }];
  aalLevel = "aal1";
  const before = await countFor("admin_mfa_enrolled");

  assert.deepEqual(await recordOwnMfaChangeAction("added"), {});

  assert.equal(await countFor("admin_mfa_enrolled"), before);
  assert.equal(notices.length, 0);
});

test("a 'removed' claim from a password-only session, or with the factor still there, records nothing", async () => {
  const { recordOwnMfaChangeAction } = await mfaActions();
  const before = await countFor("admin_mfa_self_removed");

  aalLevel = "aal1";
  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});
  aalLevel = "aal2";
  factors = [factor("f3", "verified", 60 * 60 * 1000)];
  assert.deepEqual(await recordOwnMfaChangeAction("removed"), {});

  assert.equal(await countFor("admin_mfa_self_removed"), before);
  assert.equal(notices.length, 0);
});
