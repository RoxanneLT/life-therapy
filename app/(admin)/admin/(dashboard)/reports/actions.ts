"use server";

import { prisma } from "@/lib/prisma";
import { csvRow } from "@/lib/csv";
import { requireRole } from "@/lib/auth";
import { recordExport } from "@/lib/access-log";
import { addSaDays, calendarDate, isSaDateStr, saDayStart, saFormat, saToday } from "@/lib/dates";

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
 * the exports (`dev-standards/ledgers/LESSONS.md` L-21).
 */
const toCsvRow = csvRow;

/**
 * The date range a register covers, as SAST days, or the refusal to show.
 *
 * Checked, not trusted: `new Date("garbage")` is an Invalid Date, which compares false both
 * ways, so the query matched nothing and the export downloaded an empty CSV that read as
 * "no invoices in that range".
 */
function registerRange(from: string, to: string): { from: string; to: string } | { error: string } {
  if (!from || !to) return { error: "Please select a date range." };
  if (!isSaDateStr(from) || !isSaDateStr(to)) return { error: "That date range is not valid." };
  if (from > to) return { error: "The start date is after the end date." };
  return { from, to };
}

export async function exportInvoiceRegister(
  from: string,
  to: string
): Promise<{ csv: string; filename: string } | { error: string }> {
  const { adminUser } = await requireRole("super_admin");

  const range = registerRange(from, to);
  if ("error" in range) return range;

  // `createdAt` is an instant, so the range is SAST days: from the start of `from` to the
  // start of the day after `to`. `new Date(from)` was UTC midnight (02:00 SAST) and
  // `setHours` ran in the server's zone, so an invoice raised at 01:00 SAST on the 1st
  // exported with the previous month — while its Date column, already SAST, said the 1st.
  const invoices = await prisma.invoice.findMany({
    where: {
      createdAt: { gte: saDayStart(range.from), lt: saDayStart(addSaDays(range.to, 1)) },
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
    // Amounts are in the invoice's own currency, which is not always ZAR.
    "Currency",
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
      inv.currency,
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
  await recordExport({ actorEmail: adminUser.email, report: "invoice-register", rows: rows.length, filters: { from, to } });

  return { csv, filename };
}

export async function exportSessionRegister(
  from: string,
  to: string
): Promise<{ csv: string; filename: string } | { error: string }> {
  const { adminUser } = await requireRole("super_admin");

  const range = registerRange(from, to);
  if ("error" in range) return range;

  // `date` is a calendar day (@db.Date, stored at UTC midnight), so both ends are days.
  const bookings = await prisma.booking.findMany({
    where: {
      date: { gte: calendarDate(range.from), lte: calendarDate(range.to) },
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
    // priceZarCents holds cents in the booking's own currency, despite the name (CLAUDE.md §9).
    "Price",
    "Currency",
    "Couples Partner",
    // Who cancelled and whether it was late, never the typed reason or the admin notes: a
    // register is a list of sessions, and free text about a client does not leave in a CSV.
    "Cancelled By",
    "Late Cancel",
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
      b.priceCurrency,
      b.couplesPartnerName,
      b.cancelledBy,
      b.isLateCancel ? "Yes" : "",
    ]);
  });

  const csv = [csvRow(header), ...rows].join("\r\n");
  const filename = `session-register_${from}_${to}.csv`;
  await recordExport({ actorEmail: adminUser.email, report: "session-register", rows: rows.length, filters: { from, to } });

  return { csv, filename };
}

export async function exportClientList(): Promise<
  { csv: string; filename: string } | { error: string }
> {
  const { adminUser } = await requireRole("super_admin");

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
  await recordExport({ actorEmail: adminUser.email, report: "client-list", rows: rows.length });

  return { csv, filename };
}
