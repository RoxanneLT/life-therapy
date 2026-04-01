/**
 * Invoice PDF generation and Supabase Storage upload.
 *
 * Layout matches the Life Therapy invoice template:
 *   Header  → "Invoice" title + logo (right-aligned)
 *   Meta    → Business details + VAT + address (left) | Invoice number, date, ref, due date (right)
 *   Client  → "Bill To" with client name, VAT, address
 *   Table   → Line items with sub-lines for session dates
 *   Footer  → Banking details (bottom-left) | Totals stack (bottom-right)
 */

import { jsPDF } from "jspdf";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { formatPrice } from "@/lib/utils";
import { extractInitials } from "@/lib/invoice-numbering";
import { format } from "date-fns";
import type { InvoiceLineItem } from "@/lib/billing-types";
import fs from "fs";
import path from "path";

// ─── Constants ───────────────────────────────────────────────

const PAGE_W = 210;
const PAGE_H = 297;
const ML = 18;
const MR = 18;
const MT = 20;
const MB = 20;
const CW = PAGE_W - ML - MR;

const DARK: [number, number, number] = [40, 40, 40];
const MUTED: [number, number, number] = [130, 130, 130];
const LINE_CLR: [number, number, number] = [200, 200, 200];
const TBL_HDR_BG: [number, number, number] = [245, 248, 245];
const BANK_BG: [number, number, number] = [248, 250, 248];
const BRAND_GREEN: [number, number, number] = [92, 142, 110];

// Table columns
const COL_DESC = ML;
const COL_QTY = 120;
const COL_PRICE = 155;
const COL_TOTAL = PAGE_W - MR;

// ─── Logo ────────────────────────────────────────────────────

let logoBase64: string | null = null;

function getLogoBase64(): string | null {
  if (logoBase64 !== null) return logoBase64;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo-invoice.png");
    const buf = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    logoBase64 = "";
  }
  return logoBase64 || null;
}

// ─── Helpers ─────────────────────────────────────────────────

function fmt(cents: number, currency: string): string {
  return formatPrice(cents, currency);
}

/** Split formatted price into symbol and number, e.g. "R 895,00" → ["R", "895,00"] */
function fmtParts(cents: number, currency: string): [string, string] {
  const full = formatPrice(cents, currency);
  const match = full.match(/^([^\d]+?)\s*(.+)$/);
  if (match) return [match[1].trim(), match[2]];
  return ["", full];
}

/** Draw a price with currency symbol at fixed X and number right-aligned */
function drawPrice(
  doc: jsPDF, cents: number, currency: string,
  symbolX: number, numberRightX: number, yPos: number,
) {
  const [symbol, number] = fmtParts(cents, currency);
  doc.text(symbol, symbolX, yPos);
  doc.text(number, numberRightX, yPos, { align: "right" });
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "dd/MM/yyyy");
}

// ─── Shared layout data ──────────────────────────────────────

interface InvoiceLayoutData {
  title: string;
  metaRows: [string, string][];
  isVat: boolean;
  billingName: string;
  billingEmail: string | null;
  billingAddress?: string | null;
  billingVatNumber?: string | null;
  lineItems: InvoiceLineItem[];
  currency: string;
  subtotalCents: number;
  discountCents: number;
  discountPercent: number;
  vatPercent: number;
  vatAmountCents: number;
  totalCents: number;
  paidCents: number;
  amountDueCents: number;
  couponCode?: string | null;
  showUnpaidWatermark: boolean;
  payNowUrl?: string | null;
  settings: Awaited<ReturnType<typeof getSiteSettings>>;
}

// ─── Core layout builder ─────────────────────────────────────

function buildInvoiceDoc(data: InvoiceLayoutData): jsPDF {
  const {
    title, metaRows, isVat,
    billingName, billingEmail, billingAddress, billingVatNumber,
    lineItems, currency,
    subtotalCents, discountCents, discountPercent: _discountPercent, vatPercent, vatAmountCents,
    totalCents, paidCents, amountDueCents,
    couponCode, showUnpaidWatermark, payNowUrl,
    settings,
  } = data;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MT;
  let pageNum = 1;
  let inTable = false;

  function hLine(yPos: number, x1 = ML, x2 = PAGE_W - MR) {
    doc.setDrawColor(...LINE_CLR);
    doc.setLineWidth(0.3);
    doc.line(x1, yPos, x2, yPos);
  }

  function drawTableHeader() {
    doc.setFillColor(...TBL_HDR_BG);
    doc.rect(ML, y, CW, 7, "F");
    hLine(y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK);
    doc.text("Description", COL_DESC + 3, y);
    doc.text("Quantity", COL_QTY, y, { align: "center" });
    doc.text("Excl. Price", COL_PRICE, y, { align: "right" });
    doc.text("Total", COL_TOTAL, y, { align: "right" });
    y += 3.5;
    hLine(y);
    y += 2;
  }

  function checkPageBreak(needed: number) {
    if (y + needed > PAGE_H - MB - 50) {
      doc.addPage();
      pageNum++;
      y = MT;
      if (inTable) drawTableHeader();
    }
  }

  // ══════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...DARK);
  doc.text(title, ML, y + 8);

  const logo = getLogoBase64();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", PAGE_W - MR - 45, y - 2, 45, 13);
    } catch { /* skip */ }
  }

  y += 18;
  hLine(y);
  y += 8;

  // ══════════════════════════════════════════════════════════
  // BUSINESS DETAILS (left) + META (right)
  // ══════════════════════════════════════════════════════════

  const metaX = 115;
  let lY = y;
  let rY = y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Life Therapy (Pty) Ltd", ML, lY);
  lY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);

  if (isVat && settings.vatNumber) {
    doc.text(`VAT No: ${settings.vatNumber}`, ML, lY);
    lY += 4;
  }

  if (settings.businessAddress) {
    const lines = settings.businessAddress.split(",").map((s: string) => s.trim());
    for (const line of lines) {
      doc.text(line, ML, lY);
      lY += 3.5;
    }
  }

  doc.setFontSize(8);
  for (const [label, value] of metaRows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text(label, metaX, rY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(value, metaX + 28, rY);
    rY += 4.5;
  }

  y = Math.max(lY, rY) + 4;
  hLine(y);
  y += 8;

  // ══════════════════════════════════════════════════════════
  // BILL TO
  // ══════════════════════════════════════════════════════════

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(billingName, ML, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);

  if (isVat && billingVatNumber) {
    doc.text(`Customer VAT No: ${billingVatNumber}`, ML, y);
    y += 4;
  }

  if (billingAddress) {
    const addr = doc.splitTextToSize(billingAddress, CW);
    doc.text(addr, ML, y);
    y += addr.length * 3.5;
  } else if (billingEmail) {
    doc.text(billingEmail, ML, y);
    y += 3.5;
  }

  y += 6;

  // ══════════════════════════════════════════════════════════
  // LINE ITEMS TABLE
  // ══════════════════════════════════════════════════════════

  inTable = true;
  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  for (const item of lineItems) {
    const rowH = item.subLine || item.billingNote ? 13 : 8;
    checkPageBreak(rowH);

    doc.setTextColor(...DARK);
    const descLines = doc.splitTextToSize(item.description, COL_QTY - COL_DESC - 12);
    doc.text(descLines, COL_DESC + 3, y + 4);
    doc.text(item.quantity.toFixed(2), COL_QTY, y + 4, { align: "center" });
    doc.text(fmt(item.unitPriceCents, currency), COL_PRICE, y + 4, { align: "right" });
    doc.text(fmt(item.totalCents, currency), COL_TOTAL, y + 4, { align: "right" });

    y += Math.max(descLines.length * 3.5 + 3, 7);

    if (item.subLine) {
      const sub = item.billingNote ? `${item.subLine} ${item.billingNote}` : item.subLine;
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(sub, COL_DESC + 5, y + 1);
      y += 4;
    } else if (item.billingNote) {
      doc.setFontSize(7);
      doc.setTextColor(180, 80, 80);
      doc.text(item.billingNote, COL_DESC + 5, y + 1);
      y += 4;
    }

    doc.setFontSize(8.5);
    hLine(y);
    y += 1.5;
  }

  inTable = false;

  // ══════════════════════════════════════════════════════════
  // FOOTER — Banking (bottom-left) + Totals (bottom-right)
  // ══════════════════════════════════════════════════════════

  const payNowRowH = payNowUrl ? 10 : 0;

  const footerMinY = y + 10;
  const footerH = 42 + payNowRowH;
  const footerY = Math.max(footerMinY, PAGE_H - MB - footerH);

  if (footerMinY > PAGE_H - MB - footerH) {
    if (footerMinY + footerH > PAGE_H - MB) {
      doc.addPage();
      pageNum++;
    }
  }

  y = footerY;
  hLine(y);
  y += 5;

  // ── Banking (left) ──
  const bankRows: [string, string | null | undefined][] = [
    ["Payment to bank", settings.bankName],
    ["Accountholder", settings.bankAccountHolder],
    ["Account number", settings.bankAccountNumber],
    ["Branch code", settings.bankBranchCode],
    ["Co Reg no.", settings.businessRegistrationNumber],
  ];
  const visibleBankRows = bankRows.filter(([, v]) => !!v);

  const bankPadX = 6;
  const bankPadY = 4;
  const bankRowH = 4.5;
  const bankBoxW = 88;
  const bankBoxH = bankPadY * 2 + visibleBankRows.length * bankRowH;
  const bankLabelColW = 34;

  doc.setFillColor(...BANK_BG);
  doc.setDrawColor(...LINE_CLR);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML, y - 1, bankBoxW, bankBoxH, 1.5, 1.5, "FD");

  let bY = y - 1 + bankPadY + 2;
  doc.setFontSize(7);

  for (const [label, value] of visibleBankRows) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text(`${label} :`, ML + bankPadX, bY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(value!, ML + bankPadX + bankLabelColW, bY);
    bY += bankRowH;
  }

  // ── Pay Now (pro-forma only) — below banking box ──
  if (payNowUrl) {
    const payNowY = y - 1 + bankBoxH + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...BRAND_GREEN);
    doc.text("To pay online, visit:", ML + bankPadX, payNowY);
    doc.setFontSize(7);
    const urlLines = doc.splitTextToSize(payNowUrl, bankBoxW - bankPadX * 2);
    doc.text(urlLines, ML + bankPadX, payNowY + 4);
    doc.setTextColor(...DARK);
  }

  // ── Totals (right) ──
  const totalsBoxX = ML + bankBoxW + 6;
  const totalsBoxW = PAGE_W - MR - totalsBoxX;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(totalsBoxX, y - 1, totalsBoxW, bankBoxH, 1.5, 1.5, "F");

  const tLabelX = totalsBoxX + bankPadX;
  const tValueX = totalsBoxX + totalsBoxW - bankPadX;
  let tY = y - 1 + bankPadY + 2;

  const symbolX = tValueX - 38;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  if (discountCents > 0) {
    const discountLabel = couponCode ? `Discount (${couponCode.toUpperCase()}):` : "Discount:";
    doc.setTextColor(...MUTED);
    doc.text(discountLabel, tLabelX, tY);
    doc.setTextColor(22, 163, 74);
    const [sym, num] = fmtParts(discountCents, currency);
    doc.text(sym, symbolX, tY);
    doc.text(num, tValueX, tY, { align: "right" });
    doc.setFontSize(6.5);
    doc.text("-/-", tValueX + 6, tY);
    doc.setFontSize(8);
    tY += bankRowH;
  }

  if (isVat) {
    doc.setTextColor(...MUTED);
    doc.text("Total Exclusive:", tLabelX, tY);
    doc.setTextColor(...DARK);
    drawPrice(doc, subtotalCents - discountCents, currency, symbolX, tValueX, tY);
    tY += bankRowH;

    doc.setTextColor(...MUTED);
    doc.text(`VAT (${vatPercent}%):`, tLabelX, tY);
    doc.setTextColor(...DARK);
    drawPrice(doc, vatAmountCents, currency, symbolX, tValueX, tY);
    tY += bankRowH;

    doc.setTextColor(...MUTED);
    doc.text("Sub Total:", tLabelX, tY);
    doc.setTextColor(...DARK);
    drawPrice(doc, totalCents, currency, symbolX, tValueX, tY);
    tY += bankRowH + 2;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Total:", tLabelX, tY);
  drawPrice(doc, totalCents, currency, symbolX, tValueX, tY);
  tY += bankRowH + 1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Paid:", tLabelX, tY);
  doc.setTextColor(22, 163, 74);
  drawPrice(doc, paidCents, currency, symbolX, tValueX, tY);
  tY += bankRowH + 1;

  hLine(tY - 1, tLabelX, tValueX);
  tY += 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Amount Due:", tLabelX, tY);
  drawPrice(doc, amountDueCents, currency, symbolX, tValueX, tY);

  // ── "UNPAID" diagonal watermark (pro-forma only) ──
  if (showUnpaidWatermark) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(52);
    doc.setTextColor(220, 38, 38);
    doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: 0.08 }));
    doc.text("UNPAID", 105, 148, { align: "center", angle: 45 });
    doc.setGState(new (doc as unknown as { GState: new (o: Record<string, unknown>) => unknown }).GState({ opacity: 1 }));
    doc.setTextColor(...DARK);
  }

  void pageNum; // used in checkPageBreak closure — suppress unused warning
  return doc;
}

// ─── PDF Generator (Invoice) ─────────────────────────────────

export async function generateInvoicePDF(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  const settings = await getSiteSettings();
  const lineItems = invoice.lineItems as unknown as InvoiceLineItem[];
  const currency = invoice.currency || "ZAR";
  const isVat = settings.vatRegistered && invoice.vatPercent > 0;

  let couponCode: string | null = null;
  if (invoice.discountCents > 0 && invoice.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: invoice.orderId },
      select: { coupon: { select: { code: true } } },
    });
    couponCode = order?.coupon?.code ?? null;
  }

  let billingAddress = invoice.billingAddress;
  if (!billingAddress && invoice.studentId) {
    const student = await prisma.student.findUnique({
      where: { id: invoice.studentId },
      select: { billingAddress: true, address: true },
    });
    billingAddress = student?.billingAddress ?? null;
    if (!billingAddress && student?.address) {
      try {
        const { decryptOrNull } = await import("@/lib/encryption");
        billingAddress = decryptOrNull(student.address);
      } catch { /* skip */ }
    }
  }

  const initials = extractInitials(invoice.billingName);
  const prefix = settings.invoicePrefix || "LT";

  const metaRows: [string, string][] = [
    ["Number:", invoice.invoiceNumber],
    ["Date:", fmtDate(invoice.issuedAt || invoice.createdAt)],
    ["Page:", "1"],
    ["Reference:", `${initials} - ${prefix}`],
    ["Due Date:", invoice.dueDate ? fmtDate(invoice.dueDate) : "On receipt"],
  ];
  if (invoice.discountPercent > 0) {
    metaRows.push(["Overall Discount %:", `${invoice.discountPercent.toFixed(2)}%`]);
  }

  const paidCents = invoice.status === "paid" ? (invoice.paidAmountCents ?? invoice.totalCents) : 0;
  const amountDueCents = invoice.status === "paid" ? 0 : invoice.totalCents;

  const doc = buildInvoiceDoc({
    title: isVat ? "Tax Invoice" : "Invoice",
    metaRows,
    isVat,
    billingName: invoice.billingName,
    billingEmail: invoice.billingEmail,
    billingAddress,
    billingVatNumber: invoice.billingVatNumber,
    lineItems,
    currency,
    subtotalCents: invoice.subtotalCents,
    discountCents: invoice.discountCents,
    discountPercent: invoice.discountPercent,
    vatPercent: invoice.vatPercent,
    vatAmountCents: invoice.vatAmountCents,
    totalCents: invoice.totalCents,
    paidCents,
    amountDueCents,
    couponCode,
    showUnpaidWatermark: false,
    payNowUrl: null,
    settings,
  });

  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}

// ─── PDF Generator (Pro-Forma) ───────────────────────────────

/**
 * Generate a Pro-Forma Invoice PDF for a PaymentRequest.
 * Sent with the payment request email so clients have a document
 * to reference before paying. The real tax invoice is generated
 * after payment and sent separately.
 */
export async function generateProformaInvoicePDF(
  paymentRequestId: string,
): Promise<Buffer> {
  const pr = await prisma.paymentRequest.findUniqueOrThrow({
    where: { id: paymentRequestId },
    include: {
      student: true,
      billingEntity: true,
    },
  });

  const settings = await getSiteSettings();
  const lineItems = pr.lineItems as unknown as InvoiceLineItem[];
  const currency = pr.currency || "ZAR";
  const isVat = settings.vatRegistered && (settings.vatPercent ?? 0) > 0 && pr.vatAmountCents > 0;

  let billingName = "Client";
  let billingEmail: string | null = null;
  let billingAddress: string | null = null;

  if (pr.student) {
    billingName = `${pr.student.firstName} ${pr.student.lastName}`;
    billingEmail = pr.student.billingEmail ?? pr.student.email;
    billingAddress = pr.student.billingAddress ?? null;
  } else if (pr.billingEntity) {
    billingName = pr.billingEntity.contactPerson || pr.billingEntity.name;
    billingEmail = pr.billingEntity.email;
    billingAddress = (pr.billingEntity as unknown as { address?: string | null }).address ?? null;
  }

  const prReference = `PR-${pr.billingMonth}-${pr.id.slice(-4).toUpperCase()}`;

  const metaRows: [string, string][] = [
    ["Reference:", prReference],
    ["Date:", format(new Date(), "dd/MM/yyyy")],
    ["Due Date:", fmtDate(pr.dueDate)],
    ["Period:", `${fmtDate(pr.periodStart)} – ${fmtDate(pr.periodEnd)}`],
  ];

  const vatPercent = isVat ? (settings.vatPercent ?? 15) : 0;
  const discountPercent = pr.subtotalCents > 0 && pr.discountCents > 0
    ? Math.round((pr.discountCents / pr.subtotalCents) * 100)
    : 0;

  const doc = buildInvoiceDoc({
    title: "Pro-Forma Invoice",
    metaRows,
    isVat,
    billingName,
    billingEmail,
    billingAddress,
    billingVatNumber: null,
    lineItems,
    currency,
    subtotalCents: pr.subtotalCents,
    discountCents: pr.discountCents,
    discountPercent,
    vatPercent,
    vatAmountCents: pr.vatAmountCents,
    totalCents: pr.totalCents,
    paidCents: 0,
    amountDueCents: pr.totalCents,
    couponCode: null,
    showUnpaidWatermark: true,
    payNowUrl: pr.paymentUrl ?? null,
    settings,
  });

  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}

// ─── Generate + Store (Invoice) ──────────────────────────────

export async function generateAndStoreInvoicePDF(
  invoiceId: string,
): Promise<string> {
  const pdfBuffer = await generateInvoicePDF(invoiceId);
  const storagePath = `invoices/${invoiceId}.pdf`;

  const { error } = await supabaseAdmin.storage
    .from("invoices")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload invoice PDF: ${error.message}`);
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { pdfUrl: storagePath },
  });

  return storagePath;
}

// ─── Generate + Store (Pro-Forma) ────────────────────────────

export async function generateAndStoreProformaPDF(
  paymentRequestId: string,
): Promise<string> {
  const pdfBuffer = await generateProformaInvoicePDF(paymentRequestId);
  const storagePath = `proforma/${paymentRequestId}.pdf`;

  const { error } = await supabaseAdmin.storage
    .from("invoices")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload pro-forma PDF: ${error.message}`);
  }

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { proformaPdfUrl: storagePath },
  });

  return storagePath;
}
