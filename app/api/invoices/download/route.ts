import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOptionalStudent } from "@/lib/student-auth";
import { requireRole } from "@/lib/auth";

/**
 * GET /api/invoices/download?id=xxx
 *
 * Generates a signed URL for an invoice PDF from private Supabase Storage.
 * Accessible by: the invoice's student (portal) OR any admin.
 */
export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get("id");
  if (!invoiceId) {
    return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { pdfUrl: true, studentId: true },
  });

  if (!invoice || !invoice.pdfUrl) {
    return NextResponse.json({ error: "Invoice or PDF not found" }, { status: 404 });
  }

  // Auth: admin or the invoice's own student
  let isAdmin = false;
  try { await requireRole("super_admin", "editor"); isAdmin = true; } catch { /* not admin */ }

  const student = await getOptionalStudent();
  const isOwner = student && invoice.studentId === student.id;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate signed URL (60 minutes)
  const { data, error } = await supabaseAdmin.storage
    .from("invoices")
    .createSignedUrl(invoice.pdfUrl, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate download link" }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
