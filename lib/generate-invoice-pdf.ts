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

const BRAND: [number, number, number] = [139, 168, 137];
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
    const logoPath = path.join(process.cwd(), "public", "logo.png");
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
      doc.addImage(logo, "PNG", PAGE_W - MR - 32, y - 4, 32, 32);
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
  doc.text(settings.siteName || "Life Therapy (Pty) Ltd", ML, lY);
  lY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);

  doc.text(`VAT No: ${isVat && settings.vatNumber ? settings.vatNumber : ""}`, ML, lY);
  lY += 4;

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
  } else {
    doc.text("Customer VAT No:", ML, y);
    y += 4;
  }

  if (invoice.billingAddress) {
    const addr = doc.splitTextToSize(invoice.billingAddress, CW);
    doc.text(addr, ML, y);
    y += addr.length * 3.5;
  }

  y += 6;
  hLine(y);
  y += 2;

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

  // ── Banking (left) — subtle background box ──
  const bankBoxW = 80;
  const bankBoxH = 30;
  doc.setFillColor(...BANK_BG);
  doc.rect(ML, y - 1, bankBoxW, bankBoxH, "F");

  let bY = y + 2;
  doc.setFontSize(7);

  const bankRows: [string, string | null | undefined][] = [
    ["Payment to bank :", settings.bankName],
    ["Accountholder :", settings.bankAccountHolder],
    ["Account number :", settings.bankAccountNumber],
    ["Branch code :", settings.bankBranchCode],
    ["Co Reg no. :", settings.businessRegistrationNumber],
  ];

  for (const [label, value] of bankRows) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED);
    doc.text(label, ML + 2, bY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK);
    doc.text(value, ML + 32, bY);
    bY += 4;
  }

  // ── Totals (right) ──
  const tLabelX = 125;
  const tValueX = PAGE_W - MR;
  let tY = y;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  // Discount
  doc.setTextColor(...MUTED);
  doc.text("Total Discount:", tLabelX, tY);
  doc.setTextColor(...DARK);
  doc.text(
    invoice.discountCents > 0 ? fmt(invoice.discountCents, currency) : fmt(0, currency),
    tValueX, tY, { align: "right" },
  );
  tY += 4.5;

  // Total Exclusive
  doc.setTextColor(...MUTED);
  doc.text("Total Exclusive:", tLabelX, tY);
  doc.setTextColor(...DARK);
  doc.text(fmt(invoice.subtotalCents - invoice.discountCents, currency), tValueX, tY, { align: "right" });
  tY += 4.5;

  // VAT
  doc.setTextColor(...MUTED);
  doc.text(`Total VAT${isVat ? ` (${invoice.vatPercent}%)` : ""}:`, tLabelX, tY);
  doc.setTextColor(...DARK);
  doc.text(fmt(invoice.vatAmountCents, currency), tValueX, tY, { align: "right" });
  tY += 4.5;

  // Sub Total
  doc.setTextColor(...MUTED);
  doc.text("Sub Total:", tLabelX, tY);
  doc.setTextColor(...DARK);
  doc.text(fmt(invoice.totalCents, currency), tValueX, tY, { align: "right" });
  tY += 6;

  // Grand Total — bold, larger
  hLine(tY - 1, tLabelX, tValueX);
  tY += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text("Total:", tLabelX, tY);
  doc.text(fmt(invoice.totalCents, currency), tValueX, tY, { align: "right" });

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
