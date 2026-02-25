import { prisma } from "@/lib/prisma";

export type LegalDocumentSlug = "commitment" | "terms" | "privacy";

/** Documents that require client acceptance (portal gate). */
export const REQUIRED_DOCUMENTS: LegalDocumentSlug[] = ["commitment", "terms"];

/** Documents rendered on public pages (no auth required). */
export const PUBLIC_DOCUMENTS: LegalDocumentSlug[] = ["terms", "privacy"];

/** Documents shown in onboarding step 3. */
export const ONBOARDING_DOCUMENTS: LegalDocumentSlug[] = ["commitment", "terms"];

/**
 * Get the active version of a legal document by slug.
 */
export async function getActiveDocument(slug: LegalDocumentSlug) {
  return prisma.legalDocument.findFirst({
    where: { slug, isActive: true },
    orderBy: { version: "desc" },
  });
}

/**
 * Get all versions of a document (for admin history view).
 */
export async function getDocumentHistory(slug: LegalDocumentSlug) {
  return prisma.legalDocument.findMany({
    where: { slug },
    orderBy: { version: "desc" },
    include: { _count: { select: { acceptances: true } } },
  });
}

/**
 * Check if a student has accepted the latest version of all required documents.
 * Returns the list of document slugs that need acceptance.
 */
export async function getOutstandingDocuments(
  studentId: string
): Promise<LegalDocumentSlug[]> {
  const outstanding: LegalDocumentSlug[] = [];

  for (const slug of REQUIRED_DOCUMENTS) {
    const activeDoc = await getActiveDocument(slug);
    if (!activeDoc) continue;

    const acceptance = await prisma.documentAcceptance.findUnique({
      where: {
        studentId_documentSlug_documentVersion: {
          studentId,
          documentSlug: slug,
          documentVersion: activeDoc.version,
        },
      },
    });

    if (!acceptance) outstanding.push(slug);
  }

  return outstanding;
}

/**
 * Record a client's acceptance of a document.
 */
export async function acceptDocument(
  studentId: string,
  slug: LegalDocumentSlug,
  ipAddress: string | null,
  userAgent: string | null
) {
  const activeDoc = await getActiveDocument(slug);
  if (!activeDoc) throw new Error(`No active ${slug} document found`);

  return prisma.documentAcceptance.upsert({
    where: {
      studentId_documentSlug_documentVersion: {
        studentId,
        documentSlug: slug,
        documentVersion: activeDoc.version,
      },
    },
    update: {
      ipAddress,
      userAgent,
      acceptedAt: new Date(),
    },
    create: {
      studentId,
      documentId: activeDoc.id,
      documentSlug: slug,
      documentVersion: activeDoc.version,
      ipAddress,
      userAgent,
    },
  });
}

/**
 * Publish a new version of a document. Deactivates previous version.
 * Returns the new document and count of clients who need to re-accept.
 */
export async function publishDocumentVersion(
  slug: LegalDocumentSlug,
  content: { heading: string; content: string }[],
  title: string,
  changeSummary: string,
  createdBy: string
) {
  const current = await getActiveDocument(slug);
  const newVersion = current ? current.version + 1 : 1;

  if (current) {
    await prisma.legalDocument.update({
      where: { id: current.id },
      data: { isActive: false },
    });
  }

  const newDoc = await prisma.legalDocument.create({
    data: {
      slug,
      title,
      content,
      version: newVersion,
      changeSummary,
      publishedAt: new Date(),
      isActive: true,
      createdBy,
    },
  });

  const clientsAffected = await prisma.student.count({
    where: { clientStatus: "active" },
  });

  return { document: newDoc, clientsAffected };
}

/**
 * Get acceptance stats for a document version.
 */
export async function getAcceptanceStats(
  slug: LegalDocumentSlug,
  version: number
) {
  const totalActive = await prisma.student.count({
    where: { clientStatus: "active" },
  });

  const accepted = await prisma.documentAcceptance.count({
    where: { documentSlug: slug, documentVersion: version },
  });

  return { total: totalActive, accepted, pending: totalActive - accepted };
}
