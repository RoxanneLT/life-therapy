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
  // Match currency symbol(s) then space then number
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

// ─── PDF Generator ───────────────────────────────────────────

export async function generateInvoicePDF(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  const settings = await getSiteSettings();
  const lineItems = invoice.lineItems as unknown as InvoiceLineItem[];
  const currency = invoice.currency || "ZAR";
  const isVat = settings.vatRegistered && invoice.vatPercent > 0;

  // Look up coupon code if discount was applied
  let couponCode: string | null = null;
  if (invoice.discountCents > 0 && invoice.orderId) {
    const order = await prisma.order.findUnique({
      where: { id: invoice.orderId },
      select: { coupon: { select: { code: true } } },
    });
    couponCode = order?.coupon?.code ?? null;
  }

  // Resolve billing address — fallback to student's encrypted address if not on invoice
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
    if (y + needed > PAGE_H - MB - 50) { // reserve 50mm for footer
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
  doc.text(isVat ? "Tax Invoice" : "Invoice", ML, y + 8);

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
  // BUSINESS DETAILS (left) + INVOICE META (right)
  // ══════════════════════════════════════════════════════════

  const metaX = 115;
  let lY = y;
  let rY = y;

  // Business
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

  // Invoice meta (right)
  const initials = extractInitials(invoice.billingName);
  const prefix = settings.invoicePrefix || "LT";

  const metaRows: [string, string][] = [
    ["Number:", invoice.invoiceNumber],
    ["Date:", fmtDate(invoice.issuedAt || invoice.createdAt)],
    ["Page:", `${pageNum}`],
    ["Reference:", `${initials} - ${prefix}`],
    ["Due Date:", invoice.dueDate ? fmtDate(invoice.dueDate) : "On receipt"],
  ];
  if (invoice.discountPercent > 0) {
    metaRows.push(["Overall Discount %:", `${invoice.discountPercent.toFixed(2)}%`]);
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
  doc.text(invoice.billingName, ML, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);

  if (isVat && invoice.billingVatNumber) {
    doc.text(`Customer VAT No: ${invoice.billingVatNumber}`, ML, y);
    y += 4;
  }

  if (billingAddress) {
    const addr = doc.splitTextToSize(billingAddress, CW);
    doc.text(addr, ML, y);
    y += addr.length * 3.5;
  } else if (invoice.billingEmail) {
    doc.text(invoice.billingEmail, ML, y);
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

  // Calculate footer Y — push to bottom of page if space allows
  const footerMinY = y + 10;
  const footerH = 42;
  const footerY = Math.max(footerMinY, PAGE_H - MB - footerH);

  // If we'd overflow, add page
  if (footerMinY > PAGE_H - MB - footerH) {
    if (footerMinY + footerH > PAGE_H - MB) {
      doc.addPage();
      pageNum++;
    }
  }

  y = footerY;
  hLine(y);
  y += 5;

  // ── Banking (left) — subtle background box, evenly spaced ──
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

  // ── Totals (right) — same box dimensions as banking, invisible border ──
  const totalsBoxX = ML + bankBoxW + 6;
  const totalsBoxW = PAGE_W - MR - totalsBoxX;
  // Draw invisible box (same height as banking) for alignment
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(totalsBoxX, y - 1, totalsBoxW, bankBoxH, 1.5, 1.5, "F");

  const tLabelX = totalsBoxX + bankPadX;
  const tValueX = totalsBoxX + totalsBoxW - bankPadX;
  let tY = y - 1 + bankPadY + 2; // same start as first bank row

  // Fixed R column for all totals
  const symbolX = tValueX - 38;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  // Discount (only if applicable)
  if (invoice.discountCents > 0) {
    const discountLabel = couponCode ? `Discount (${couponCode.toUpperCase()}):` : "Discount:";
    doc.setTextColor(...MUTED);
    doc.text(discountLabel, tLabelX, tY);
    doc.setTextColor(22, 163, 74);
    const [sym, num] = fmtParts(invoice.discountCents, currency);
    doc.text(sym, symbolX, tY);
    doc.text(num, tValueX, tY, { align: "right" });
    doc.setFontSize(6.5);
    doc.text("-/-", tValueX + 6, tY);
    doc.setFontSize(8);
    tY += bankRowH;
  }

  if (isVat) {
    // VAT registered — show full breakdown
    doc.setTextColor(...MUTED);
    doc.text("Total Exclusive:", tLabelX, tY);
    doc.setTextColor(...DARK);
    drawPrice(doc, invoice.subtotalCents - invoice.discountCents, currency, symbolX, tValueX, tY);
    tY += bankRowH;

    doc.setTextColor(...MUTED);
    doc.text(`VAT (${invoice.vatPercent}%):`, tLabelX, tY);
    doc.setTextColor(...DARK);
    drawPrice(doc, invoice.vatAmountCents, currency, symbolX, tValueX, tY);
    tY += bankRowH;

    doc.setTextColor(...MUTED);
    doc.text("Sub Total:", tLabelX, tY);
    doc.setTextColor(...DARK);
    drawPrice(doc, invoice.totalCents, currency, symbolX, tValueX, tY);
    tY += bankRowH + 2;
  }

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Total:", tLabelX, tY);
  drawPrice(doc, invoice.totalCents, currency, symbolX, tValueX, tY);
  tY += bankRowH + 1;

  // Paid
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Paid:", tLabelX, tY);
  doc.setTextColor(22, 163, 74);
  const paidCents = invoice.status === "paid" ? (invoice.paidAmountCents ?? invoice.totalCents) : 0;
  drawPrice(doc, paidCents, currency, symbolX, tValueX, tY);
  tY += bankRowH + 1;

  // Line between Paid and Amount Due
  hLine(tY - 1, tLabelX, tValueX);
  tY += 3;

  // Amount Due — same font/size as Total
  const amountDue = invoice.status === "paid" ? 0 : invoice.totalCents;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Amount Due:", tLabelX, tY);
  drawPrice(doc, amountDue, currency, symbolX, tValueX, tY);

  // ── Buffer output ──
  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}

// ─── Generate + Store in Supabase ────────────────────────────

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
