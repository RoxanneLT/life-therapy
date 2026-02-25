"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { generateAndStoreInvoicePDF } from "@/lib/generate-invoice-pdf";
import { sendInvoiceEmail } from "@/lib/send-invoice";

// ────────────────────────────────────────────────────────────
// Mark invoice as paid (from invoice list page)
// ────────────────────────────────────────────────────────────

export async function markInvoicePaidFromListAction(
  invoiceId: string,
  method: string,
  reference?: string,
) {
  await requireRole("super_admin");

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "paid",
      paymentMethod: method,
      eftReference: method === "eft" ? reference : undefined,
      paidAt: new Date(),
    },
    select: { paymentRequestId: true, studentId: true },
  });

  if (invoice.paymentRequestId) {
    await prisma.paymentRequest.update({
      where: { id: invoice.paymentRequestId },
      data: { status: "paid" },
    });
  }

  revalidatePath("/admin/invoices");
  if (invoice.studentId) {
    revalidatePath(`/admin/clients/${invoice.studentId}`);
  }
}

// ────────────────────────────────────────────────────────────
// Void invoice (from invoice list page)
// ────────────────────────────────────────────────────────────

export async function voidInvoiceFromListAction(invoiceId: string) {
  await requireRole("super_admin");

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "cancelled" },
    select: { studentId: true },
  });

  await prisma.booking.updateMany({
    where: { invoiceId },
    data: { invoiceId: null, paymentRequestId: null },
  });

  revalidatePath("/admin/invoices");
  if (invoice.studentId) {
    revalidatePath(`/admin/clients/${invoice.studentId}`);
  }
}

// ────────────────────────────────────────────────────────────
// Resend invoice (from invoice list page)
// ────────────────────────────────────────────────────────────

export async function resendInvoiceFromListAction(invoiceId: string) {
  await requireRole("super_admin");

  await generateAndStoreInvoicePDF(invoiceId);
  await sendInvoiceEmail(invoiceId);

  revalidatePath("/admin/invoices");
}

// ────────────────────────────────────────────────────────────
// CSV Export
// ────────────────────────────────────────────────────────────

interface ExportFilters {
  financialYear?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
  status?: string;
}

export async function exportInvoicesCsvAction(
  filters: ExportFilters,
): Promise<string> {
  await requireRole("super_admin");

  const where: Record<string, unknown> = {};

  // Financial year: FY2026 = 1 Mar 2025 → 28 Feb 2026
  if (filters.financialYear) {
    const fy = parseInt(filters.financialYear, 10);
    const fyStart = new Date(fy - 1, 2, 1); // March 1 of previous year
    const fyEnd = new Date(fy, 2, 1); // March 1 of FY year (exclusive)
    where.createdAt = { gte: fyStart, lt: fyEnd };
  } else if (filters.startDate || filters.endDate) {
    const range: Record<string, Date> = {};
    if (filters.startDate) range.gte = new Date(filters.startDate);
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setDate(end.getDate() + 1);
      range.lt = end;
    }
    where.createdAt = range;
  }

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      student: { select: { firstName: true, lastName: true } },
      billingEntity: { select: { name: true } },
    },
  });

  const headers = [
    "Invoice Number",
    "Date",
    "Client",
    "Billing Contact",
    "Billing Email",
    "Type",
    "Currency",
    "Subtotal",
    "Discount",
    "VAT",
    "Total",
    "Status",
    "Payment Method",
    "Payment Date",
    "Reference",
  ];

  const rows = invoices.map((inv) => {
    const clientName = inv.student
      ? `${inv.student.firstName} ${inv.student.lastName}`
      : inv.billingEntity?.name ?? "";
    return [
      inv.invoiceNumber,
      inv.createdAt.toISOString().split("T")[0],
      clientName,
      inv.billingName,
      inv.billingEmail,
      inv.type,
      inv.currency,
      (inv.subtotalCents / 100).toFixed(2),
      (inv.discountCents / 100).toFixed(2),
      (inv.vatAmountCents / 100).toFixed(2),
      (inv.totalCents / 100).toFixed(2),
      inv.status,
      inv.paymentMethod ?? "",
      inv.paidAt ? inv.paidAt.toISOString().split("T")[0] : "",
      inv.eftReference ?? inv.paystackReference ?? "",
    ];
  });

  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const csv = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ].join("\n");

  return csv;
}
