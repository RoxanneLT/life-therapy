"use server";

import { prisma } from "@/lib/prisma";
import { csvRow } from "@/lib/csv";
import { requireRole } from "@/lib/auth";
import { saFormat, saToday } from "@/lib/dates";

/**
 * SAST, not the server's zone — these rows are a financial register. `toLocaleDateString`
 * without a `timeZone` formats in the RUNTIME's zone (UTC on Vercel), so an invoice
 * created at 00:30 SAST exported under the previous day, and into the previous month on
 * the first of a month.
 */
const formatDate = (date: Date) => saFormat(new Date(date), "d MMM yyyy");

function formatCurrency(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Kept as a thin alias so the call sites below read unchanged. The escaping itself moved
 * to lib/csv.ts, which was the point: this file's copy and the invoice export's copy were
 * byte-identical and BOTH missed formula injection, so a fix here would have reached half
 * the exports (`dev-standards/LESSONS.md` L-21).
 */
const toCsvRow = csvRow;

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

  const csv = [csvRow(header), ...rows].join("\r\n");
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

  const csv = [csvRow(header), ...rows].join("\r\n");
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

  const csv = [csvRow(header), ...rows].join("\r\n");
  const filename = `client-list_${saToday()}.csv`;

  return { csv, filename };
}
