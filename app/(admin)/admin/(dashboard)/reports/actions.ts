"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(cents: number): string {
  return (cents / 100).toFixed(2);
}

function escapeCsv(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map((f) => escapeCsv(f == null ? "" : String(f))).join(",");
}

export async function exportInvoiceRegister(
  from: string,
  to: string
): Promise<{ csv: string; filename: string } | { error: string }> {
  await requireRole("super_admin");

  if (!from || !to) return { error: "Please select a date range." };

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const invoices = await prisma.invoice.findMany({
    where: {
      createdAt: { gte: fromDate, lte: toDate },
    },
    orderBy: { createdAt: "asc" },
    include: {
      student: { select: { firstName: true, lastName: true } },
      billingEntity: { select: { name: true } },
    },
  });

  const header = [
    "Invoice #",
    "Date",
    "Client",
    "Billing Name",
    "Billing Email",
    "Type",
    "Subtotal",
    "Discount",
    "VAT",
    "Total",
    "Status",
    "Payment Method",
    "Paid Date",
    "Billing Month",
  ];

  const rows = invoices.map((inv) => {
    const client = inv.student
      ? `${inv.student.firstName} ${inv.student.lastName}`
      : inv.billingEntity?.name ?? "";
    return toCsvRow([
      inv.invoiceNumber,
      formatDate(inv.createdAt),
      client,
      inv.billingName,
      inv.billingEmail,
      inv.type,
      formatCurrency(inv.subtotalCents),
      formatCurrency(inv.discountCents),
      formatCurrency(inv.vatAmountCents),
      formatCurrency(inv.totalCents),
      inv.status,
      inv.paymentMethod,
      inv.paidAt ? formatDate(inv.paidAt) : "",
      inv.billingMonth,
    ]);
  });

  const csv = [header.join(","), ...rows].join("\n");
  const filename = `invoice-register_${from}_${to}.csv`;

  return { csv, filename };
}

export async function exportSessionRegister(
  from: string,
  to: string
): Promise<{ csv: string; filename: string } | { error: string }> {
  await requireRole("super_admin");

  if (!from || !to) return { error: "Please select a date range." };

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
    include: {
      student: { select: { firstName: true, lastName: true } },
    },
  });

  const header = [
    "Date",
    "Start",
    "End",
    "Duration (min)",
    "Client",
    "Email",
    "Session Type",
    "Session Mode",
    "Status",
    "Price (ZAR)",
    "Couples Partner",
    "Admin Notes",
    "Cancellation Reason",
  ];

  const rows = bookings.map((b) => {
    const client = b.student
      ? `${b.student.firstName} ${b.student.lastName}`
      : b.clientName;
    return toCsvRow([
      formatDate(b.date),
      b.startTime,
      b.endTime,
      b.durationMinutes,
      client,
      b.clientEmail,
      b.sessionType,
      b.sessionMode,
      b.status,
      formatCurrency(b.priceZarCents),
      b.couplesPartnerName,
      b.adminNotes,
      b.cancellationReason,
    ]);
  });

  const csv = [header.join(","), ...rows].join("\n");
  const filename = `session-register_${from}_${to}.csv`;

  return { csv, filename };
}

export async function exportClientList(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  await requireRole("super_admin");

  const students = await prisma.student.findMany({
    orderBy: { lastName: "asc" },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      clientStatus: true,
      source: true,
      billingType: true,
      createdAt: true,
      dateOfBirth: true,
      gender: true,
      relationshipStatus: true,
      referralSource: true,
    },
  });

  const header = [
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Status",
    "Source",
    "Billing Type",
    "Joined",
    "Date of Birth",
    "Gender",
    "Relationship Status",
    "Referral Source",
  ];

  const rows = students.map((s) =>
    toCsvRow([
      s.firstName,
      s.lastName,
      s.email,
      s.phone,
      s.clientStatus,
      s.source,
      s.billingType,
      formatDate(s.createdAt),
      s.dateOfBirth ? formatDate(s.dateOfBirth) : "",
      s.gender,
      s.relationshipStatus,
      s.referralSource,
    ])
  );

  const csv = [header.join(","), ...rows].join("\n");
  const filename = `client-list_${new Date().toISOString().slice(0, 10)}.csv`;

  return { csv, filename };
}
