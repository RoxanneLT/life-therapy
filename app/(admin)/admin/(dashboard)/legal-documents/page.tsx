export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import {
  getActiveDocument,
  getDocumentHistory,
  getAcceptanceStats,
  REQUIRED_DOCUMENTS,
  type LegalDocumentSlug,
} from "@/lib/legal-documents";
import { LegalDocumentsClient } from "./legal-documents-client";
import { PageHeader } from "@/components/admin/page-header";

const ALL_SLUGS: LegalDocumentSlug[] = ["commitment", "terms", "privacy"];

export default async function LegalDocumentsPage() {
  const { adminUser } = await requireRole("super_admin");

  const documents = await Promise.all(
    ALL_SLUGS.map(async (slug) => {
      const active = await getActiveDocument(slug);
      const history = await getDocumentHistory(slug);
      const stats = active
        ? await getAcceptanceStats(slug, active.version)
        : null;

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
    })
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal Documents"
        description="Manage commitment agreements, terms & conditions, and privacy policy. Publishing a new version will require active clients to re-accept."
      />
      <LegalDocumentsClient
        documents={documents}
        adminUserId={adminUser.id}
      />
    </div>
  );
}
