import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { jsPDF } from "jspdf";

export async function GET(request: NextRequest) {
  const { student } = await getAuthenticatedStudent();

  const number = request.nextUrl.searchParams.get("number");
  if (!number) {
    return NextResponse.json({ error: "Missing certificate number" }, { status: 400 });
  }

  const certificate = await prisma.certificate.findFirst({
    where: { certificateNumber: number, studentId: student.id },
    include: { course: { select: { title: true } } },
  });

  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const studentName = `${student.firstName} ${student.lastName}`;
  const courseTitle = certificate.course.title;
  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Generate PDF — landscape A4
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Background
  doc.setFillColor(253, 251, 247); // warm cream
  doc.rect(0, 0, w, h, "F");

  // Border
  doc.setDrawColor(139, 168, 137); // brand green
  doc.setLineWidth(2);
  doc.rect(10, 10, w - 20, h - 20);
  doc.setLineWidth(0.5);
  doc.rect(14, 14, w - 28, h - 28);

  // Header
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(139, 168, 137);
  doc.text("LIFE THERAPY", w / 2, 35, { align: "center" });

  // Title
  doc.setFontSize(32);
  doc.setTextColor(60, 60, 60);
  doc.text("Certificate of Completion", w / 2, 55, { align: "center" });

  // Decorative line
  doc.setDrawColor(139, 168, 137);
  doc.setLineWidth(1);
  doc.line(w / 2 - 40, 62, w / 2 + 40, 62);

  // "This certifies that"
  doc.setFontSize(12);
  doc.setTextColor(120, 120, 120);
  doc.text("This certifies that", w / 2, 78, { align: "center" });

  // Student name
  doc.setFontSize(28);
  doc.setTextColor(60, 60, 60);
  doc.text(studentName, w / 2, 95, { align: "center" });

  // "has successfully completed"
  doc.setFontSize(12);
  doc.setTextColor(120, 120, 120);
  doc.text("has successfully completed the course", w / 2, 110, { align: "center" });

  // Course title
  doc.setFontSize(22);
  doc.setTextColor(139, 168, 137);
  doc.text(courseTitle, w / 2, 125, { align: "center" });

  // Date
  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text(`Issued: ${issuedDate}`, w / 2, 145, { align: "center" });

  // Certificate number
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 160);
  doc.text(`Certificate No: ${certificate.certificateNumber}`, w / 2, 155, { align: "center" });

  // Signature image
  try {
    const sigPath = join(process.cwd(), "public", "images", "signature.png");
    const sigBuffer = readFileSync(sigPath);
    const sigBase64 = sigBuffer.toString("base64");
    const sigWidth = 40;
    const sigHeight = 30;
    doc.addImage(`data:image/png;base64,${sigBase64}`, "PNG", w / 2 - sigWidth / 2, 155, sigWidth, sigHeight);
  } catch {
    // Fallback: draw a line if image not found
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(w / 2 - 30, 172, w / 2 + 30, 172);
  }

  // Signature text
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("Roxanne Bouwer", w / 2, 190, { align: "center" });
  doc.setFontSize(8);
  doc.text("Life Therapy — Personal Development Coach", w / 2, 195, { align: "center" });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${certificate.certificateNumber}.pdf"`,
    },
  });
}
