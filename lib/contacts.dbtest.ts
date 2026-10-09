import { testEmail } from "@/test/db/harness";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { upsertContact } from "@/lib/contacts";

after(() => prisma.$disconnect());

// upsertContact is what remains of the 2026-02-24 contact merge: every intake path (newsletter,
// booking, import) lands on one Student per address. These pin its promises: one row per address
// whatever its case, consent never downgraded, source never overwritten, and (owner's ruling,
// 2026-10-09) blank fields filled while curated ones are kept, with any differing value audited.

const conflictsFor = (studentId: string) =>
  prisma.auditLog.findMany({ where: { entityType: "student", entityId: studentId, action: "contact_field_conflict" } });

test("one row per address, whatever case or whitespace it arrives in", async () => {
  const email = testEmail("case");
  const a = await upsertContact({ email: `  ${email.toUpperCase()} `, firstName: "Ann", source: "newsletter" });
  const b = await upsertContact({ email, source: "booking" });
  assert.equal(a.id, b.id);
  assert.equal(a.email, email);
  assert.equal(await prisma.student.count({ where: { email } }), 1);
});

test("source is kept from the first contact", async () => {
  const email = testEmail("source");
  await upsertContact({ email, source: "newsletter" });
  const again = await upsertContact({ email, source: "booking" });
  assert.equal(again.source, "newsletter");
});

test("consent given once is never withdrawn by a later contact without it", async () => {
  const email = testEmail("consent");
  const first = await upsertContact({ email, source: "newsletter", consentGiven: true, consentMethod: "newsletter_form" });
  assert.equal(first.consentGiven, true);
  const later = await upsertContact({ email, source: "booking", consentGiven: false });
  assert.equal(later.consentGiven, true);
  assert.equal(later.consentMethod, "newsletter_form");
});

test("consent is upgraded when a later contact gives it", async () => {
  const email = testEmail("upgrade");
  await upsertContact({ email, source: "booking" });
  const later = await upsertContact({ email, source: "newsletter", consentGiven: true, consentMethod: "newsletter_form" });
  assert.equal(later.consentGiven, true);
  assert.ok(later.consentDate);
});

test("a curated name is kept when a different one arrives, and the difference is audited", async () => {
  const email = testEmail("keep");
  const s = await upsertContact({ email, firstName: "Anne", lastName: "Smith", source: "booking" });
  const later = await upsertContact({ email, firstName: "Ann", lastName: "Smith", source: "newsletter" });
  assert.equal(later.firstName, "Anne");
  const [entry, ...rest] = await conflictsFor(s.id);
  assert.equal(rest.length, 0);
  assert.deepEqual(entry?.metadata, { source: "newsletter", kept: "stored", fields: { firstName: { stored: "Anne", incoming: "Ann" } } });
});

test("the 'Friend' placeholder and blank fields are filled, with nothing audited", async () => {
  const email = testEmail("fill");
  const s = await upsertContact({ email, source: "newsletter" });
  assert.equal(s.firstName, "Friend");
  const later = await upsertContact({ email, firstName: "Thandi", lastName: "Nkosi", gender: "female", source: "booking" });
  assert.equal(later.firstName, "Thandi");
  assert.equal(later.lastName, "Nkosi");
  assert.equal(later.gender, "female");
  assert.equal((await conflictsFor(s.id)).length, 0);
});

test("the same value in another case is not a conflict", async () => {
  const email = testEmail("samecase");
  const s = await upsertContact({ email, firstName: "Anne", source: "booking" });
  await upsertContact({ email, firstName: "  anne ", source: "newsletter" });
  assert.equal((await conflictsFor(s.id)).length, 0);
});

// Phone is encrypted at rest and the audit log is not, so a differing number is recorded as
// differing, never by value. A planted copy of either number in the entry fails this test.
test("a different phone keeps the stored one, and the audit entry carries neither number", async () => {
  const email = testEmail("phone");
  const s = await upsertContact({ email, phone: "082 111 2222", source: "booking" });
  const later = await upsertContact({ email, phone: "083 999 8888", source: "booking" });
  assert.equal(later.phone, s.phone);
  const [entry] = await conflictsFor(s.id);
  const text = JSON.stringify(entry?.metadata);
  assert.ok(text.includes("phone"), text);
  assert.ok(!/111|2222|999|8888/.test(text), `a phone number leaked into the audit log: ${text}`);
});
