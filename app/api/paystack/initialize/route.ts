import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { initializeTransaction } from "@/lib/paystack";
import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";

export async function POST(request: Request) {
  // Auth check
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const student = await prisma.student.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 401 });
  }

  const body = await request.json();
  const { type, id } = body as { type: string; id: string };

  if (!type || !id) {
    return NextResponse.json(
      { error: "Missing type or id" },
      { status: 400 },
    );
  }

  try {
    if (type === "payment_request") {
      return await handlePaymentRequest(id, student);
    }

    if (type === "invoice") {
      return await handleInvoice(id, student);
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err) {
    console.error("[paystack/initialize] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment initialization failed" },
      { status: 500 },
    );
  }
}

async function handlePaymentRequest(
  prId: string,
  student: { id: string; email: string; billingEmail: string | null },
) {
  const pr = await prisma.paymentRequest.findUnique({
    where: { id: prId },
  });

  if (!pr) {
    return NextResponse.json({ error: "Payment request not found" }, { status: 404 });
  }

  if (pr.studentId !== student.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (pr.status !== "pending" && pr.status !== "overdue") {
    return NextResponse.json(
      { error: `Cannot pay a ${pr.status} payment request` },
      { status: 400 },
    );
  }

  const reference = `pr-${pr.id.slice(-8)}-${Date.now()}`;
  const email = student.billingEmail || student.email;

  const result = await initializeTransaction({
    email,
    amount: pr.totalCents,
    currency: pr.currency || "ZAR",
    reference,
    callback_url: `${APP_URL}/portal/invoices`,
    metadata: { paymentRequestId: pr.id },
  });

  await prisma.paymentRequest.update({
    where: { id: pr.id },
    data: {
      paymentUrl: result.authorization_url,
      paystackReference: reference,
    },
  });

  return NextResponse.json({
    authorization_url: result.authorization_url,
    reference: result.reference,
  });
}

async function handleInvoice(
  invoiceId: string,
  student: { id: string; email: string; billingEmail: string | null },
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.studentId !== student.id) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (invoice.status !== "payment_requested" && invoice.status !== "overdue") {
    return NextResponse.json(
      { error: `Cannot pay a ${invoice.status} invoice` },
      { status: 400 },
    );
  }

  const reference = `inv-${invoice.id.slice(-8)}-${Date.now()}`;
  const email = student.billingEmail || student.email;

  const result = await initializeTransaction({
    email,
    amount: invoice.totalCents,
    currency: invoice.currency || "ZAR",
    reference,
    callback_url: `${APP_URL}/portal/invoices`,
    metadata: { invoiceId: invoice.id },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      paymentUrl: result.authorization_url,
      paystackReference: reference,
    },
  });

  return NextResponse.json({
    authorization_url: result.authorization_url,
    reference: result.reference,
  });
}
