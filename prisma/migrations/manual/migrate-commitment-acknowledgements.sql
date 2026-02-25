-- Migrate existing commitment_acknowledgements into document_acceptances.
-- Run AFTER seeding legal documents (seed-legal-documents.ts).
-- Uses 'da_' prefix on id to avoid any collision with other cuid values.

INSERT INTO document_acceptances (
    "id",
    "studentId",
    "documentId",
    "documentSlug",
    "documentVersion",
    "ipAddress",
    "userAgent",
    "acceptedAt"
)
SELECT
    'da_' || ca.id,
    ca."studentId",
    ld.id,
    'commitment',
    1,
    ca."ipAddress",
    ca."userAgent",
    ca."acknowledgedAt"
FROM commitment_acknowledgements ca
CROSS JOIN legal_documents ld
WHERE ld.slug = 'commitment' AND ld.version = 1
ON CONFLICT ("studentId", "documentSlug", "documentVersion") DO NOTHING;
