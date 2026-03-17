import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { getSiteSettings } from "@/lib/settings";
import { jsPDF } from "jspdf";

// ─── Brand colours ───────────────────────────────────────────

const GREEN: [number, number, number] = [139, 168, 137]; // #8BA889
const GREEN_LIGHT: [number, number, number] = [212, 228, 209]; // #D4E4D1
const GREEN_DARK: [number, number, number] = [94, 125, 92]; // #5E7D5C
const ORANGE: [number, number, number] = [224, 79, 42]; // #E04F2A
const DARK_GREY: [number, number, number] = [58, 58, 58]; // #3A3A3A
const CREAM: [number, number, number] = [253, 251, 247]; // #FDFBF7
const MUTED: [number, number, number] = [120, 120, 120];

// ─── Image helpers ───────────────────────────────────────────

function loadImage(filename: string): string | null {
  try {
    const filePath = join(process.cwd(), "public", "images", filename);
    const buf = readFileSync(filePath);
    const ext = filename.endsWith(".jpg") || filename.endsWith(".jpeg") ? "JPEG" : "PNG";
    return `data:image/${ext.toLowerCase()};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function loadLogo(): string | null {
  try {
    const filePath = join(process.cwd(), "public", "logo.png");
    const buf = readFileSync(filePath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ─── Corner ornament helper ──────────────────────────────────

function drawCorner(
  doc: jsPDF,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  size: number,
) {
  doc.line(cx, cy, cx + dx * size, cy);
  doc.line(cx, cy, cx, cy + dy * size);
}

// ─── Diamond helper ──────────────────────────────────────────

function drawDiamond(doc: jsPDF, x: number, y: number, size: number) {
  // jsPDF triangle method isn't great — use lines to form a diamond
  doc.setFillColor(...ORANGE);
  doc.triangle(x, y - size, x + size, y, x, y + size, "F");
  doc.triangle(x, y - size, x - size, y, x, y + size, "F");
}

// ─── Main handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { student } = await getAuthenticatedStudent();

  const number = request.nextUrl.searchParams.get("number");
  if (!number) {
    return NextResponse.json(
      { error: "Missing certificate number" },
      { status: 400 },
    );
  }

  const [certificate, settings] = await Promise.all([
    prisma.certificate.findFirst({
      where: { certificateNumber: number, studentId: student.id },
      include: { course: { select: { title: true } } },
    }),
    getSiteSettings(),
  ]);

  if (!certificate) {
    return NextResponse.json(
      { error: "Certificate not found" },
      { status: 404 },
    );
  }

  const studentName = `${student.firstName} ${student.lastName}`;
  const courseTitle = certificate.course.title;
  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString(
    "en-ZA",
    { day: "numeric", month: "long", year: "numeric" },
  );

  // Company footer — built from site settings
  const regNr = settings.businessRegistrationNumber || "2019/570691/07";
  const email = settings.email || "hello@life-therapy.co.za";
  const footerText = `Life Therapy (Pty) Ltd  |  Reg: ${regNr}  |  ${email}  |  life-therapy.online`;

  // Load images
  const bgImage = loadImage("LT_greenBG.png");
  const logoImage = loadLogo();
  const sigImage = loadImage("signature.png");

  // ── Generate PDF — landscape A4 ────────────────────────────
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  const w = doc.internal.pageSize.getWidth(); // 297
  const h = doc.internal.pageSize.getHeight(); // 210

  const MARGIN = 14;
  const INNER = MARGIN + 4;

  // ── 1. Cream background ──
  doc.setFillColor(...CREAM);
  doc.rect(0, 0, w, h, "F");

  // ── 2. Watermark — subtle lotus pattern ──
  if (bgImage) {
    doc.saveGraphicsState();
    // @ts-expect-error — jsPDF GState for opacity
    doc.setGState(new doc.GState({ opacity: 0.05 }));
    doc.addImage(bgImage, "PNG", 0, 0, w, h);
    doc.restoreGraphicsState();
  }

  // ── 3. Borders ──
  // Outer — brand green
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(1.5);
  doc.rect(MARGIN, MARGIN, w - 2 * MARGIN, h - 2 * MARGIN);

  // Inner — orange accent
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.5);
  doc.rect(INNER, INNER, w - 2 * INNER, h - 2 * INNER);

  // ── 4. Corner ornaments — green ──
  const orn = 7;
  const off = INNER + 3;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.8);
  drawCorner(doc, off, off, 1, 1, orn); // bottom-left
  drawCorner(doc, w - off, off, -1, 1, orn); // bottom-right
  drawCorner(doc, off, h - off, 1, -1, orn); // top-left
  drawCorner(doc, w - off, h - off, -1, -1, orn); // top-right

  // ── 5. Logo — top-left, inside borders ──
  const logoTop = h - INNER - 5; // 5mm padding below inner border
  if (logoImage) {
    const logoW = 42;
    const logoH = 12.4; // natural ratio 159:47
    doc.addImage(
      logoImage,
      "PNG",
      INNER + 8,
      logoTop - logoH,
      logoW,
      logoH,
    );
  }

  // ── 6. Title — centered, clearly below logo ──
  const titleY = h - 52;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(30);
  doc.setTextColor(...DARK_GREY);
  doc.text("Certificate of Completion", w / 2, titleY, { align: "center" });

  // ── 7. Orange divider with diamond ──
  const divY = titleY + 10;
  const lineW = 50;
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.8);
  doc.line(w / 2 - lineW / 2, divY, w / 2 - 2.5, divY);
  doc.line(w / 2 + 2.5, divY, w / 2 + lineW / 2, divY);
  drawDiamond(doc, w / 2, divY, 2);

  // ── 8. "This certifies that" ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("This certifies that", w / 2, 74, { align: "center" });

  // ── 9. Student name ──
  const nameY = 88;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...DARK_GREY);
  doc.text(studentName, w / 2, nameY, { align: "center" });

  // Subtle green underline
  doc.setDrawColor(...GREEN_LIGHT);
  doc.setLineWidth(0.4);
  doc.line(w / 2 - 40, nameY + 3, w / 2 + 40, nameY + 3);

  // ── 10. "has successfully completed the course" ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text("has successfully completed the course", w / 2, 100, {
    align: "center",
  });

  // ── 11. Course title — brand green ──
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(22);
  doc.setTextColor(...GREEN_DARK);
  doc.text(courseTitle, w / 2, 114, { align: "center" });

  // ── 12. Small orange divider ──
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.5);
  doc.line(w / 2 - 20, 121, w / 2 + 20, 121);

  // ── 13. Date ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Issued: ${issuedDate}`, w / 2, 129, { align: "center" });

  // ── 14. Certificate number ──
  doc.setFontSize(8);
  doc.setTextColor(176, 176, 176);
  doc.text(`Certificate No: ${certificate.certificateNumber}`, w / 2, 135, {
    align: "center",
  });

  // ── 15. Signature image ──
  if (sigImage) {
    const sigW = 34;
    const sigH = 25;
    doc.addImage(
      sigImage,
      "PNG",
      w / 2 - sigW / 2,
      139,
      sigW,
      sigH,
    );
  }

  // Signature line — green
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(w / 2 - 25, 165, w / 2 + 25, 165);

  // ── 16. Signatory ──
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GREY);
  doc.text("Roxanne Bouwer", w / 2, 171, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("Life Therapy  \u2014  Personal Development Coach", w / 2, 176, {
    align: "center",
  });

  // ── 17. Footer — company details from settings ──
  const footerY = MARGIN + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(footerText, w / 2, footerY, { align: "center" });

  // ── 18. Decorative dots — orange center, green flanks ──
  const dotY = MARGIN + 7;
  for (let i = -2; i <= 2; i++) {
    if (i === 0) {
      doc.setFillColor(...ORANGE);
      doc.circle(w / 2 + i * 3, dotY, 1, "F");
    } else {
      doc.setFillColor(...GREEN_LIGHT);
      doc.circle(w / 2 + i * 3, dotY, 0.6, "F");
    }
  }

  // ── Output ─────────────────────────────────────────────────
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificate.certificateNumber}.pdf"`,
    },
  });
}
