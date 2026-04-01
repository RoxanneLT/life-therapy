import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateProformaInvoicePDF } from "@/lib/generate-invoice-pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRole("super_admin", "editor");
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const pr = await prisma.paymentRequest.findUnique({
    where: { id },
    select: { id: true, proformaPdfUrl: true, billingMonth: true },
  });

  if (!pr) {
    return new NextResponse("Not found", { status: 404 });
  }

  let pdfBuffer: Buffer;

  if (pr.proformaPdfUrl) {
    const { data, error } = await supabaseAdmin.storage
      .from("invoices")
      .download(pr.proformaPdfUrl);
    if (!error && data) {
      pdfBuffer = Buffer.from(await data.arrayBuffer());
    } else {
      pdfBuffer = await generateProformaInvoicePDF(id);
    }
  } else {
    pdfBuffer = await generateProformaInvoicePDF(id);
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="ProForma_${pr.billingMonth}.pdf"`,
    },
  });
}
