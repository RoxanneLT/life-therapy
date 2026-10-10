import { prisma } from "@/lib/prisma";
import { initializeTransaction } from "@/lib/paystack";
import { loadRequestAmounts } from "@/lib/billing";
import { getBaseUrlForCurrency } from "@/lib/region";

/**
 * A Paystack link for what is still owed on a payment request, stored on the request.
 *
 * Every link is for the BALANCE, never the total. Until 2026-10-10 the four places that made one
 * each charged `totalCents`, so a client who had paid R400 of R1000 by EFT saw "R600 owing" beside
 * a Pay button that charged R1000. The webhook then settled the request with a second tax invoice
 * and the R400 fell off the row (walk-oct-final 01 F2, 02 N1). The stored link is also what the
 * pro-forma PDF and the WhatsApp reminders send, which is why a part-payment refreshes it
 * (refreshPaymentLink below).
 *
 * `email` is the address Paystack receipts go to; omitted, it is the request's billing contact.
 */
export async function createPaymentRequestLink(
  paymentRequestId: string,
  email?: string,
): Promise<{ url: string; reference: string } | { error: string }> {
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: { id: true, totalCents: true, paidAmountCents: true, invoiceId: true, currency: true, billingEntityId: true, studentId: true },
  });
  if (!pr) return { error: "That payment request no longer exists." };

  const { balance } = await loadRequestAmounts(pr);
  if (balance <= 0) return { error: "Nothing is left to pay on this request." };

  const to = email || (await billingEmailFor(pr));
  if (!to) return { error: "No billing email on this client — add one before generating a payment link." };

  const reference = `pr-${pr.id.slice(-8)}-${Date.now()}`;
  const currency = pr.currency || "ZAR";
  const result = await initializeTransaction({
    email: to,
    amount: balance,
    currency,
    reference,
    callback_url: `${getBaseUrlForCurrency(currency)}/portal/invoices`,
    metadata: { paymentRequestId: pr.id },
  });
  await prisma.paymentRequest.update({
    where: { id: pr.id },
    data: { paymentUrl: result.authorization_url, paystackReference: reference },
  });
  return { url: result.authorization_url, reference: result.reference };
}

/**
 * After money arrives short of the total, a stored link still charges the old amount. Replace it
 * with one for the new balance; if that cannot be made, clear it, so the PDF and reminders fall
 * back to the portal, which makes a fresh one on Pay. A request with no stored link is left alone.
 */
export async function refreshPaymentLink(paymentRequestId: string): Promise<void> {
  const pr = await prisma.paymentRequest.findUnique({ where: { id: paymentRequestId }, select: { paymentUrl: true } });
  if (!pr?.paymentUrl) return;
  const result = await createPaymentRequestLink(paymentRequestId).catch((err: unknown) => {
    console.error(`Payment link refresh failed for ${paymentRequestId}:`, err);
    return { error: "failed" };
  });
  if ("error" in result) {
    await prisma.paymentRequest.update({ where: { id: paymentRequestId }, data: { paymentUrl: null } });
  }
}

async function billingEmailFor(pr: { billingEntityId: string | null; studentId: string | null }): Promise<string> {
  if (pr.billingEntityId) {
    const entity = await prisma.billingEntity.findUnique({ where: { id: pr.billingEntityId }, select: { email: true } });
    return entity?.email ?? "";
  }
  if (!pr.studentId) return "";
  const student = await prisma.student.findUnique({ where: { id: pr.studentId }, select: { email: true, billingEmail: true } });
  return student?.billingEmail || student?.email || "";
}
