import { testEmail } from "@/test/db/harness";
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { upsertContact } from "@/lib/contacts";

after(() => prisma.$disconnect());

// upsertContact is what remains of the 2026-02-24 contact merge: every intake path (newsletter,
// booking, purchase) lands on one Student per address. These pin the promises in its doc comment
// that hold today: one row per address whatever its case, consent never downgraded, source never
// overwritten. Its "only fill in blank fields" comment is NOT pinned: the code overwrites a
// non-blank name whenever a new one is given, and which of the two is intended is undecided.

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
