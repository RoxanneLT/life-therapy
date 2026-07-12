"use server";

import { requireRole } from "@/lib/auth";
import {
  publishDocumentVersion,
  REQUIRED_DOCUMENTS,
  type LegalDocumentSlug,
} from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { revalidatePath } from "next/cache";
import { getBaseUrlForCurrency } from "@/lib/region";
import { resolveClientCurrencies } from "@/lib/billing";


export async function publishDocumentVersionAction(
  slug: LegalDocumentSlug,
  content: { heading: string; content: string }[],
  title: string,
  changeSummary: string,
  adminUserId: string
) {
  await requireRole("super_admin");

  if (!changeSummary.trim()) {
    throw new Error("Change summary is required");
  }
  if (content.length === 0) {
    throw new Error("At least one section is required");
  }

  const result = await publishDocumentVersion(
    slug,
    content,
    title,
    changeSummary.trim(),
    adminUserId
  );

  revalidatePath("/admin/legal-documents");
  revalidatePath("/terms");
  revalidatePath("/privacy");
  revalidatePath("/portal/settings");

  // Send notification emails for required documents (commitment, terms)
  if (REQUIRED_DOCUMENTS.includes(slug)) {
    // Fire and forget — don't block the response
    sendDocumentUpdateNotifications(
      title,
      changeSummary.trim()
    ).catch(console.error);
  }

  return {
    version: result.document.version,
    clientsAffected: result.clientsAffected,
  };
}

async function sendDocumentUpdateNotifications(
  documentTitle: string,
  changeSummary: string
) {
  const activeClients = await prisma.student.findMany({
    where: { clientStatus: "active" },
    select: { id: true, firstName: true, email: true },
  });

  // Each client's portal link must point at THEIR domain, not a hardcoded .co.za —
  // this goes to every active client, international ones included.
  const currencies = await resolveClientCurrencies(activeClients.map((c) => c.id));
  const currencyById = new Map(currencies.map((c) => [c.studentId, c.currency]));

  for (const client of activeClients) {
    if (!client.email) continue;

    try {
      const portalBase = getBaseUrlForCurrency(currencyById.get(client.id));
      const email = await renderEmail("legal_document_updated", {
        firstName: client.firstName || "",
        documentTitle,
        changeSummary,
        portalUrl: portalBase + "/portal",
      });

      await sendEmail({
        to: client.email,
        ...email,
        templateKey: "legal_document_updated",
        studentId: client.id,
        metadata: { documentTitle, changeSummary },
      });
    } catch (err) {
      console.error(`Failed to notify ${client.id}:`, err);
    }
  }
}
