import { makeStudent } from "@/test/db/harness";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

// The webhook verifies its HMAC with this key, read at call time (lib/paystack.ts). The storage
// client is built when lib/supabase-admin.ts is imported, so it needs a URL first; nothing listens
// there, and the PDF upload that would use it is caught by its callers.
const SECRET = "sk_test_dbtest";
process.env.PAYSTACK_SECRET_KEY = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "dbtest";
// Imported on first use, so the lines above have run first.
const route = () => import("@/app/api/webhooks/paystack/route");
const settle: typeof import("@/lib/create-invoice").createInvoiceFromPaymentRequest = async (...args) =>
  (await import("@/lib/create-invoice")).createInvoiceFromPaymentRequest(...args);

// Invoice numbers come from one row, which production has and a database built from prisma/sql/ does not.
before(() => prisma.invoiceSequence.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} }));
after(() => prisma.$disconnect());

/**
 * Money arriving from Paystack, end to end through the route. No stored payment link, so a part
 * payment refreshes nothing and no test reaches Paystack. PDF and email failures are caught by the
 * route and the engine, so a test run without storage or Resend still exercises every money write.
 */
async function deliver(metadata: Record<string, string>, amount: number, reference: string, currency = "ZAR") {
  const body = JSON.stringify({ event: "charge.success", data: { amount, currency, reference, metadata } });
  const signature = createHmac("sha512", SECRET).update(body).digest("hex");
  const res = await (await route()).POST(new Request("http://localhost/api/webhooks/paystack", { method: "POST", body, headers: { "x-paystack-signature": signature } }));
  return res.status;
}

const ref = (label: string) => `${label}-${randomUUID().slice(0, 8)}`;

async function makeRequest(totalCents: number) {
  const s = await makeStudent("paystack");
  return prisma.paymentRequest.create({
    data: {
      studentId: s.id,
      billingMonth: "2026-03",
      periodStart: new Date("2026-03-01T00:00:00Z"),
      periodEnd: new Date("2026-03-31T00:00:00Z"),
      subtotalCents: totalCents,
      totalCents,
      dueDate: new Date("2026-04-07T00:00:00Z"),
      lineItems: [],
    },
  });
}

async function makeInvoice(totalCents: number) {
  const s = await makeStudent("paystack-inv");
  return prisma.invoice.create({
    data: {
      invoiceNumber: `DBTEST-${randomUUID().slice(0, 12)}`,
      type: "ad_hoc_session",
      studentId: s.id,
      billingName: "Db Test",
      billingEmail: s.email,
      subtotalCents: totalCents,
      totalCents,
      status: "payment_requested",
      lineItems: [],
    },
  });
}

const audits = (entityId: string, action: string) => prisma.auditLog.findMany({ where: { entityId, action } });
const request = (id: string) => prisma.paymentRequest.findUniqueOrThrow({ where: { id } });

test("a part payment is recorded once, however often Paystack delivers it", async () => {
  const pr = await makeRequest(100_000);
  const r1 = ref("part");

  assert.equal(await deliver({ paymentRequestId: pr.id }, 40_000, r1), 200);
  assert.equal(await deliver({ paymentRequestId: pr.id }, 40_000, r1), 200);

  const row = await request(pr.id);
  assert.equal(row.status, "pending", "a part payment does not settle the request");
  assert.equal(row.paidAmountCents, 40_000, "a redelivery is not added twice");
  assert.equal((await audits(pr.id, "payment_shortfall")).length, 1);
});

test("the balance settles the request with one invoice for everything received, and its retry adds nothing", async () => {
  const pr = await makeRequest(100_000);
  await deliver({ paymentRequestId: pr.id }, 40_000, ref("part"));
  const rest = ref("rest");

  assert.equal(await deliver({ paymentRequestId: pr.id }, 60_000, rest), 200);
  assert.equal(await deliver({ paymentRequestId: pr.id }, 60_000, rest), 200);

  const row = await request(pr.id);
  assert.equal(row.status, "paid");
  assert.equal(row.paidAmountCents, 100_000);
  const invoices = await prisma.invoice.findMany({ where: { paymentRequestId: pr.id } });
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].id, row.invoiceId);
  assert.equal(invoices[0].paidAmountCents, 100_000);
  assert.equal((await audits(pr.id, "payment_overpaid")).length, 0, "the settling charge's retry is not an overpayment");
});

test("a further charge on a paid request is recorded as an overpayment, once", async () => {
  const pr = await makeRequest(100_000);
  await deliver({ paymentRequestId: pr.id }, 100_000, ref("full"));
  const extra = ref("extra");

  assert.equal(await deliver({ paymentRequestId: pr.id }, 30_000, extra), 200);
  assert.equal(await deliver({ paymentRequestId: pr.id }, 30_000, extra), 200);

  const overpaid = await audits(pr.id, "payment_overpaid");
  assert.equal(overpaid.length, 1);
  assert.deepEqual(
    { overpaid: (overpaid[0].metadata as Record<string, unknown>).overpaidCents, reference: (overpaid[0].metadata as Record<string, unknown>).reference },
    { overpaid: 30_000, reference: extra },
  );
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 1, "no second invoice");
});

test("a request marked paid by hand, then paid by link, records the link's money as an overpayment", async () => {
  const pr = await makeRequest(50_000);
  await settle(pr.id, { reference: "eft-123", method: "eft", amountCents: 0 });

  assert.equal(await deliver({ paymentRequestId: pr.id }, 50_000, ref("late")), 200);

  const [overpaid] = await audits(pr.id, "payment_overpaid");
  assert.equal((overpaid?.metadata as Record<string, unknown> | undefined)?.overpaidCents, 50_000);
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 1);
});

test("settling a paid request again returns its invoice rather than making a second", async () => {
  const pr = await makeRequest(50_000);
  const first = await settle(pr.id, { reference: "eft-a", method: "eft", amountCents: 0 });
  const second = await settle(pr.id, { reference: "eft-b", method: "eft", amountCents: 0 });

  assert.equal(second.id, first.id);
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 1);
});

test("a charge the handler cannot record is answered 500, so Paystack retries it", async () => {
  assert.equal(await deliver({ paymentRequestId: `missing-${randomUUID()}` }, 10_000, ref("lost")), 500);
  assert.equal(await deliver({ invoiceId: `missing-${randomUUID()}` }, 10_000, ref("lost")), 500);
});

test("a direct invoice: a part payment once, the balance settles it, and later money is an overpayment", async () => {
  const inv = await makeInvoice(50_000);
  const part = ref("inv-part");

  assert.equal(await deliver({ invoiceId: inv.id }, 20_000, part), 200);
  assert.equal(await deliver({ invoiceId: inv.id }, 20_000, part), 200);
  let row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  assert.equal(row.status, "payment_requested");
  assert.equal(row.paidAmountCents, 20_000);
  assert.equal((await audits(inv.id, "payment_shortfall")).length, 1);

  const rest = ref("inv-rest");
  assert.equal(await deliver({ invoiceId: inv.id }, 30_000, rest), 200);
  assert.equal(await deliver({ invoiceId: inv.id }, 30_000, rest), 200);
  row = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  assert.equal(row.status, "paid");
  assert.equal(row.paidAmountCents, 50_000);
  assert.equal((await audits(inv.id, "payment_overpaid")).length, 0);

  assert.equal(await deliver({ invoiceId: inv.id }, 5_000, ref("inv-extra")), 200);
  assert.equal((await audits(inv.id, "payment_overpaid")).length, 1);
});

const overpaidCents = async (entityId: string) =>
  (await audits(entityId, "payment_overpaid")).map((a) => (a.metadata as Record<string, unknown>).overpaidCents);

test("a link opened, the invoice marked paid by EFT, then the link paid: the charge is an overpayment", async () => {
  const inv = await makeInvoice(50_000);
  const link = ref("opened");
  // What /api/paystack/initialize stores when the client opens Pay, before any money moves.
  await prisma.invoice.update({ where: { id: inv.id }, data: { paystackReference: link } });
  // An admin's mark-paid: no amount written.
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "paid", paymentMethod: "eft", paidAt: new Date() } });

  assert.equal(await deliver({ invoiceId: inv.id }, 50_000, link), 200);

  assert.deepEqual(await overpaidCents(inv.id), [50_000], "the stored link reference is not proof the charge was counted");
});

test("a charge on a voided request is recorded as unowed, and does not settle it", async () => {
  const pr = await makeRequest(70_000);
  await prisma.paymentRequest.update({ where: { id: pr.id }, data: { status: "cancelled" } });

  assert.equal(await deliver({ paymentRequestId: pr.id }, 70_000, ref("void")), 200);

  assert.equal((await request(pr.id)).status, "cancelled");
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 0, "no tax invoice for a voided request");
  assert.deepEqual(await overpaidCents(pr.id), [70_000]);
});

test("a retry after the invoice was written but the request was not finishes the request", async () => {
  const pr = await makeRequest(40_000);
  const charge = ref("half");
  const inv = await makeInvoice(40_000);
  await prisma.invoice.update({
    where: { id: inv.id },
    data: { paymentRequestId: pr.id, status: "paid", paymentMethod: "paystack", paystackReference: charge, paidAmountCents: 40_000 },
  });

  assert.equal(await deliver({ paymentRequestId: pr.id }, 40_000, charge), 200);

  const row = await request(pr.id);
  assert.deepEqual({ status: row.status, invoiceId: row.invoiceId, paid: row.paidAmountCents }, { status: "paid", invoiceId: inv.id, paid: 40_000 });
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 1);
});

test("a charge on the invoice of a voided request settles neither, and is recorded as unowed", async () => {
  const pr = await makeRequest(60_000);
  const inv = await makeInvoice(60_000);
  // A part payment made the request's invoice early; the request was then voided.
  await prisma.invoice.update({ where: { id: inv.id }, data: { paymentRequestId: pr.id, paidAmountCents: 20_000 } });
  await prisma.paymentRequest.update({ where: { id: pr.id }, data: { status: "cancelled", paidAmountCents: 20_000, invoiceId: inv.id } });

  assert.equal(await deliver({ invoiceId: inv.id }, 40_000, ref("void-inv")), 200);

  assert.equal((await request(pr.id)).status, "cancelled");
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status, "payment_requested");
  assert.deepEqual(await overpaidCents(inv.id), [40_000]);
});

test("a charge on a cancelled invoice is recorded as unowed and leaves it cancelled", async () => {
  const inv = await makeInvoice(30_000);
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "cancelled" } });

  assert.equal(await deliver({ invoiceId: inv.id }, 30_000, ref("cancelled-inv")), 200);

  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status, "cancelled");
  assert.deepEqual(await overpaidCents(inv.id), [30_000]);
});

test("the settlement engine refuses a voided request and writes nothing", async () => {
  const pr = await makeRequest(25_000);
  await prisma.paymentRequest.update({ where: { id: pr.id }, data: { status: "cancelled" } });

  await assert.rejects(settle(pr.id, { reference: "eft-void", method: "eft", amountCents: 0 }), /voided/);

  assert.equal((await request(pr.id)).status, "cancelled");
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 0);
});
