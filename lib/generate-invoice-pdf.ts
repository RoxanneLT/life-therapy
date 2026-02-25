/**
 * Invoice PDF generation and Supabase Storage upload.
 *
 * Layout matches the Life Therapy invoice template:
 *   Header  → "Tax Invoice" / "Invoice" + logo
 *   Meta    → Business details (left) + invoice details (right)
 *   Client  → Billing name / VAT / address
 *   Table   → Line items with sub-lines for dates and notes
 *   Footer  → Banking details (left) + totals stack (right)
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

const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const MARGIN_TOP = 15;
const MARGIN_BOTTOM = 25;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const BRAND_GREEN: [number, number, number] = [139, 168, 137]; // #8BA889
const DARK_TEXT: [number, number, number] = [33, 33, 33];
const MUTED_TEXT: [number, number, number] = [120, 120, 120];
const LINE_COLOR: [number, number, number] = [220, 220, 220];
const TABLE_HEADER_BG: [number, number, number] = [245, 248, 245];

// Column layout for line items table
const COL_DESC_X = MARGIN_LEFT;
const COL_QTY_X = 135;
const COL_PRICE_X = 155;
const COL_TOTAL_X = PAGE_WIDTH - MARGIN_RIGHT;

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
  return format(new Date(d), "d MMMM yyyy");
}

// ─── PDF Generator ───────────────────────────────────────────

/**
 * Fetch an invoice from the DB and generate a PDF buffer.
 */
export async function generateInvoicePDF(invoiceId: string): Promise<Buffer> {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
  });

  const settings = await getSiteSettings();
  const lineItems = invoice.lineItems as unknown as InvoiceLineItem[];
  const currency = invoice.currency || "ZAR";
  const isVat = settings.vatRegistered && invoice.vatPercent > 0;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN_TOP;
  let pageNum = 1;

  // ── Utility: draw table header ──
  let inTable = false;
  function drawTableHeader() {
    doc.setFillColor(...TABLE_HEADER_BG);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7, "F");
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...DARK_TEXT);
    doc.text("Description", COL_DESC_X + 2, y);
    doc.text("Qty", COL_QTY_X, y, { align: "center" });
    doc.text("Excl. Price", COL_PRICE_X, y, { align: "right" });
    doc.text("Total", COL_TOTAL_X, y, { align: "right" });
    y += 4;
    hLine(y);
    y += 2;
  }

  // ── Utility: check page break ──
  function checkPageBreak(needed: number) {
    if (y + needed > PAGE_HEIGHT - MARGIN_BOTTOM) {
      doc.addPage();
      pageNum++;
      y = MARGIN_TOP;
      if (inTable) drawTableHeader();
    }
  }

  // ── Utility: horizontal line ──
  function hLine(yPos: number) {
    doc.setDrawColor(...LINE_COLOR);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, yPos, PAGE_WIDTH - MARGIN_RIGHT, yPos);
  }

  // ══════════════════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════════════════

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_GREEN);
  doc.text(isVat ? "Tax Invoice" : "Invoice", MARGIN_LEFT, y + 8);

  // Logo (top right)
  const logo = getLogoBase64();
  if (logo) {
    try {
      doc.addImage(logo, "PNG", PAGE_WIDTH - MARGIN_RIGHT - 30, y - 2, 30, 30);
    } catch {
      // Logo render failed — skip
    }
  }

  y += 18;
  hLine(y);
  y += 6;

  // ══════════════════════════════════════════════════════════
  // BUSINESS DETAILS (left) + INVOICE META (right)
  // ══════════════════════════════════════════════════════════

  const leftX = MARGIN_LEFT;
  const rightX = 120;
  let leftY = y;
  let rightY = y;

  // Business details
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK_TEXT);
  doc.text("Life Therapy (Pty) Ltd", leftX, leftY);
  leftY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_TEXT);

  if (settings.businessRegistrationNumber) {
    doc.text(`Reg: ${settings.businessRegistrationNumber}`, leftX, leftY);
    leftY += 4;
  }
  if (isVat && settings.vatNumber) {
    doc.text(`VAT: ${settings.vatNumber}`, leftX, leftY);
    leftY += 4;
  }
  if (settings.businessAddress) {
    const addrLines = doc.splitTextToSize(settings.businessAddress, 90);
    doc.text(addrLines, leftX, leftY);
    leftY += addrLines.length * 3.5;
  }

  // Invoice meta (right column)
  doc.setFontSize(8.5);
  const initials = extractInitials(invoice.billingName);
  const prefix = settings.invoicePrefix || "LT";
  const metaLabels = ["Number:", "Date:", "Reference:", "Page:", "Due Date:"];
  const metaValues = [
    invoice.invoiceNumber,
    fmtDate(invoice.issuedAt || invoice.createdAt),
    `${initials} - ${prefix}`,
    `${pageNum}`,
    invoice.dueDate ? fmtDate(invoice.dueDate) : "On receipt",
  ];

  if (invoice.discountPercent > 0) {
    metaLabels.push("Discount:");
    metaValues.push(`${invoice.discountPercent}%`);
  }

  for (let i = 0; i < metaLabels.length; i++) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED_TEXT);
    doc.text(metaLabels[i], rightX, rightY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK_TEXT);
    doc.text(metaValues[i], rightX + 25, rightY);
    rightY += 4.5;
  }

  y = Math.max(leftY, rightY) + 4;
  hLine(y);
  y += 6;

  // ══════════════════════════════════════════════════════════
  // CLIENT DETAILS
  // ══════════════════════════════════════════════════════════

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED_TEXT);
  doc.text("Bill To:", MARGIN_LEFT, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...DARK_TEXT);
  doc.text(invoice.billingName, MARGIN_LEFT, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_TEXT);

  if (isVat && invoice.billingVatNumber) {
    doc.text(`VAT: ${invoice.billingVatNumber}`, MARGIN_LEFT, y);
    y += 4;
  }
  if (invoice.billingAddress) {
    const clientAddr = doc.splitTextToSize(invoice.billingAddress, CONTENT_WIDTH);
    doc.text(clientAddr, MARGIN_LEFT, y);
    y += clientAddr.length * 3.5;
  }

  y += 4;
  hLine(y);
  y += 2;

  // ══════════════════════════════════════════════════════════
  // LINE ITEMS TABLE
  // ══════════════════════════════════════════════════════════

  inTable = true;
  drawTableHeader();

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  for (const item of lineItems) {
    // Estimate height needed for this row
    const rowHeight = item.subLine || item.billingNote ? 12 : 7;
    checkPageBreak(rowHeight);

    // Main line
    doc.setTextColor(...DARK_TEXT);
    const descLines = doc.splitTextToSize(item.description, COL_QTY_X - COL_DESC_X - 8);
    doc.text(descLines, COL_DESC_X + 2, y + 3.5);
    doc.text(item.quantity.toFixed(2), COL_QTY_X, y + 3.5, { align: "center" });
    doc.text(fmt(item.unitPriceCents, currency), COL_PRICE_X, y + 3.5, { align: "right" });
    doc.text(fmt(item.totalCents, currency), COL_TOTAL_X, y + 3.5, { align: "right" });

    y += Math.max(descLines.length * 3.5 + 2, 6);

    // Sub-line (session date/time) — billing note appended inline if present
    if (item.subLine) {
      const subText = item.billingNote
        ? `${item.subLine} ${item.billingNote}`
        : item.subLine;
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED_TEXT);
      doc.text(subText, COL_DESC_X + 4, y + 1);
      y += 3.5;
    } else if (item.billingNote) {
      // Standalone billing note for non-session line items
      doc.setFontSize(7.5);
      doc.setTextColor(180, 80, 80);
      doc.text(item.billingNote, COL_DESC_X + 4, y + 1);
      y += 3.5;
    }

    // Reset font
    doc.setFontSize(8.5);

    // Row separator
    hLine(y);
    y += 1.5;
  }

  inTable = false;
  y += 4;

  // ══════════════════════════════════════════════════════════
  // FOOTER: Banking (left) + Totals (right)
  // ══════════════════════════════════════════════════════════

  checkPageBreak(40);

  hLine(y);
  y += 6;

  const footerLeftX = MARGIN_LEFT;
  const footerRightX = 130;
  let footerLeftY = y;
  let footerRightY = y;

  // Banking details (left)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK_TEXT);
  doc.text("Banking Details", footerLeftX, footerLeftY);
  footerLeftY += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED_TEXT);

  const bankDetails: [string, string | null | undefined][] = [
    ["Bank:", settings.bankName],
    ["Account Holder:", settings.bankAccountHolder],
    ["Account No:", settings.bankAccountNumber],
    ["Branch:", settings.bankBranchCode],
    ["Reg No:", settings.businessRegistrationNumber],
  ];

  for (const [label, value] of bankDetails) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MUTED_TEXT);
    doc.text(label, footerLeftX, footerLeftY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...DARK_TEXT);
    doc.text(value, footerLeftX + 28, footerLeftY);
    footerLeftY += 4;
  }

  // Totals stack (right)
  const totalsLabelX = footerRightX;
  const totalsValueX = PAGE_WIDTH - MARGIN_RIGHT;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);

  // Subtotal (before invoice-level discount)
  doc.setTextColor(...MUTED_TEXT);
  doc.text("Total Exclusive:", totalsLabelX, footerRightY);
  doc.setTextColor(...DARK_TEXT);
  doc.text(fmt(invoice.subtotalCents, currency), totalsValueX, footerRightY, { align: "right" });
  footerRightY += 5;

  // Discount line (if applicable)
  if (invoice.discountCents > 0) {
    doc.setTextColor(22, 163, 74); // green-600
    doc.text(
      `Discount${invoice.discountPercent > 0 ? ` (${invoice.discountPercent}%)` : ""}:`,
      totalsLabelX,
      footerRightY,
    );
    doc.text(`-${fmt(invoice.discountCents, currency)}`, totalsValueX, footerRightY, { align: "right" });
    footerRightY += 5;
    doc.setTextColor(...MUTED_TEXT);
  }

  // VAT line (only if registered)
  if (isVat) {
    doc.setTextColor(...MUTED_TEXT);
    doc.text(`VAT (${invoice.vatPercent}%):`, totalsLabelX, footerRightY);
    doc.setTextColor(...DARK_TEXT);
    doc.text(fmt(invoice.vatAmountCents, currency), totalsValueX, footerRightY, { align: "right" });
    footerRightY += 5;
  }

  // Grand total
  hLine(footerRightY - 1);
  footerRightY += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...DARK_TEXT);
  doc.text("Total:", totalsLabelX, footerRightY);
  doc.text(fmt(invoice.totalCents, currency), totalsValueX, footerRightY, { align: "right" });

  // ── Convert to Buffer ──
  const arrayBuf = doc.output("arraybuffer");
  return Buffer.from(arrayBuf);
}

// ─── Generate + Store in Supabase ────────────────────────────

/**
 * Generate the invoice PDF, upload to Supabase Storage (invoices bucket),
 * update the Invoice record with the storage path, and return the path.
 */
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
