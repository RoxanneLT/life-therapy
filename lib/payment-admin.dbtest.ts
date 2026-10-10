import { makeStudent } from "@/test/db/harness";
import { after, before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";

/**
 * What an admin's click writes, against a real database. The server actions are driven directly,
 * with requireRole and next/cache stood in (scripts/db-test.mjs passes --experimental-test-module-mocks).
 * Storage and Paystack are unreachable here; PDF and email failures are caught by their callers.
 */
const SECRET = "sk_test_dbtest";
process.env.PAYSTACK_SECRET_KEY = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:9";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "dbtest";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "dbtest";

mock.module(pathToFileURL(join(process.cwd(), "lib/auth.ts")).href, {
  namedExports: { requireRole: async () => ({ adminUser: { email: "dbtest@example.test", role: "super_admin" }, user: {} }) },
});
mock.module("next/cache", { namedExports: { revalidatePath: () => {}, revalidateTag: () => {} } });

// Imported on first use, after the mocks above are in place.
const listActions = () => import("@/app/(admin)/admin/(dashboard)/invoices/actions");
const clientActions = () => import("@/app/(admin)/admin/(dashboard)/clients/[id]/actions");
const route = () => import("@/app/api/webhooks/paystack/route");

before(() => prisma.invoiceSequence.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} }));
after(() => prisma.$disconnect());

async function deliver(metadata: Record<string, string>, amount: number, reference: string) {
  const body = JSON.stringify({ event: "charge.success", data: { amount, currency: "ZAR", reference, metadata } });
  const signature = createHmac("sha512", SECRET).update(body).digest("hex");
  const res = await (await route()).POST(new Request("http://localhost/api/webhooks/paystack", { method: "POST", body, headers: { "x-paystack-signature": signature } }));
  return res.status;
}

const ref = (label: string) => `${label}-${randomUUID().slice(0, 8)}`;

async function makeRequest(totalCents: number) {
  const s = await makeStudent("admin-pay");
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

async function makeInvoice(totalCents: number, data: { paymentRequestId?: string; paystackReference?: string } = {}) {
  const s = await makeStudent("admin-inv");
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
      ...data,
    },
  });
}

const overpaidCents = async (entityId: string) =>
  (await prisma.auditLog.findMany({ where: { entityId, action: "payment_overpaid" } })).map(
    (a) => (a.metadata as Record<string, unknown>).overpaidCents,
  );

test("neither invoice mark-paid flips a voided request to paid", async () => {
  const { markInvoicePaidFromListAction } = await listActions();
  const { markInvoicePaidAction } = await clientActions();
  const pr = await makeRequest(80_000);
  const inv = await makeInvoice(80_000, { paymentRequestId: pr.id });
  await prisma.paymentRequest.update({ where: { id: pr.id }, data: { status: "cancelled" } });

  assert.match((await markInvoicePaidFromListAction(inv.id, "eft", "EFT-1")).error ?? "", /voided/);
  assert.match((await markInvoicePaidAction(inv.id, "eft", "EFT-1", pr.studentId!)).error ?? "", /voided/);

  assert.equal((await prisma.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } })).status, "cancelled");
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).status, "payment_requested");
});

test("an invoice already paid is refused by both mark-paid actions", async () => {
  const { markInvoicePaidFromListAction } = await listActions();
  const { markInvoicePaidAction } = await clientActions();
  const inv = await makeInvoice(10_000);
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "paid" } });

  assert.match((await markInvoicePaidFromListAction(inv.id, "eft")).error ?? "", /already paid/);
  assert.match((await markInvoicePaidAction(inv.id, "eft", undefined, inv.studentId!)).error ?? "", /already paid/);
});

test("marked paid with 'Paystack' by hand, then the opened link is paid: the charge is an overpayment", async () => {
  const { markInvoicePaidFromListAction } = await listActions();
  const link = ref("opened");
  const inv = await makeInvoice(50_000, { paystackReference: link });

  assert.deepEqual(await markInvoicePaidFromListAction(inv.id, "paystack"), {});
  assert.equal(await deliver({ invoiceId: inv.id }, 50_000, link), 200);

  assert.deepEqual(await overpaidCents(inv.id), [50_000]);
  // Kept: the POPIA erasure checklist reads it to know Paystack holds this client (lib/popia/external-holders.ts).
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).paystackReference, link);
});

test("a charge that settled an invoice is not an overpayment when Paystack redelivers it", async () => {
  const charge = ref("settled");
  const inv = await makeInvoice(30_000, { paystackReference: charge });
  assert.equal(await deliver({ invoiceId: inv.id }, 30_000, charge), 200);

  assert.equal(await deliver({ invoiceId: inv.id }, 30_000, charge), 200);

  assert.deepEqual(await overpaidCents(inv.id), []);
});

test("a re-click on a request whose invoice is paid finishes the request, not a second invoice", async () => {
  const { markPaymentRequestPaidAction } = await clientActions();
  const pr = await makeRequest(40_000);
  const inv = await makeInvoice(40_000, { paymentRequestId: pr.id });
  // A settlement written halfway: the invoice is paid, the request is not.
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "paid", paidAmountCents: 40_000 } });

  assert.deepEqual(await markPaymentRequestPaidAction(pr.id, "manual", undefined, pr.studentId!), {});

  const row = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } });
  assert.deepEqual({ status: row.status, invoiceId: row.invoiceId }, { status: "paid", invoiceId: inv.id });
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 1);
});

test("a second charge on a halfway-settled request is recorded as an overpayment, once", async () => {
  const pr = await makeRequest(40_000);
  const inv = await makeInvoice(40_000, { paymentRequestId: pr.id });
  // The invoice is paid, the request was never told, so the portal offers the full balance again.
  await prisma.invoice.update({ where: { id: inv.id }, data: { status: "paid", paidAmountCents: 40_000 } });
  const second = ref("second");

  // Asserted after the first delivery: Paystack does not redeliver a 200, and a redelivery found the
  // request paid and recorded the charge by the closed-row path, which hid the loss.
  assert.equal(await deliver({ paymentRequestId: pr.id }, 40_000, second), 200);
  assert.deepEqual(await overpaidCents(pr.id), [40_000]);
  assert.equal(await deliver({ paymentRequestId: pr.id }, 40_000, second), 200);

  const row = await prisma.paymentRequest.findUniqueOrThrow({ where: { id: pr.id } });
  assert.deepEqual({ status: row.status, invoiceId: row.invoiceId }, { status: "paid", invoiceId: inv.id });
  assert.deepEqual(await overpaidCents(pr.id), [40_000]);
  assert.equal(await prisma.invoice.count({ where: { paymentRequestId: pr.id } }), 1);
});

test("recording an EFT on an open request does not bring its voided invoice back as paid", async () => {
  const { markPaymentRequestPaidFromListAction } = await listActions();
  const pr = await makeRequest(40_000);
  const voided = await makeInvoice(40_000, { paymentRequestId: pr.id });
  await prisma.invoice.update({ where: { id: voided.id }, data: { status: "cancelled" } });

  await markPaymentRequestPaidFromListAction(pr.id, "eft", 40_000, "EFT-2");

  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: voided.id } })).status, "cancelled");
});
