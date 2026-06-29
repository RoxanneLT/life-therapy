export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import {
  getActiveDocument,
  getDocumentHistory,
  getAcceptanceStats,
  REQUIRED_DOCUMENTS,
  type LegalDocumentSlug,
} from "@/lib/legal-documents";
import { LegalDocumentsClient } from "../../legal-documents/legal-documents-client";

const ALL_LEGAL_SLUGS: LegalDocumentSlug[] = ["commitment", "terms", "privacy"];

async function loadLegalDocuments() {
  return Promise.all(
    ALL_LEGAL_SLUGS.map(async (slug) => {
      const active = await getActiveDocument(slug);
      const history = await getDocumentHistory(slug);
      const stats = active ? await getAcceptanceStats(slug, active.version) : null;

      return {
        slug,
        active: active
          ? {
              id: active.id,
              title: active.title,
              content: active.content as { heading: string; content: string }[],
              version: active.version,
              publishedAt: active.publishedAt?.toISOString() ?? null,
              changeSummary: active.changeSummary,
            }
          : null,
        stats,
        requiresAcceptance: REQUIRED_DOCUMENTS.includes(slug),
        history: history.map((h) => ({
          id: h.id,
          version: h.version,
          title: h.title,
          content: h.content as { heading: string; content: string }[],
          changeSummary: h.changeSummary,
          publishedAt: h.publishedAt?.toISOString() ?? null,
          isActive: h.isActive,
          acceptanceCount: h._count.acceptances,
        })),
      };
    }),
  );
}

export default async function LegalSettingsPage() {
  const { adminUser } = await requireRole("super_admin");
  const documents = await loadLegalDocuments();

  return (
    <LegalDocumentsClient
      documents={documents}
      adminUserId={adminUser.id}
      embedded
      headerTitle="Legal Documents"
      headerDescription="Terms & conditions, privacy policy and client commitment."
    />
  );
}
