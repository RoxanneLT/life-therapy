-- CreateTable: legal_documents
CREATE TABLE "legal_documents" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "changeSummary" TEXT,
    "publishedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_slug_version_key" ON "legal_documents"("slug", "version");
CREATE INDEX "legal_documents_slug_isActive_idx" ON "legal_documents"("slug", "isActive");

-- CreateTable: document_acceptances
CREATE TABLE "document_acceptances" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentSlug" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_acceptances_studentId_documentSlug_documentVersion_key"
    ON "document_acceptances"("studentId", "documentSlug", "documentVersion");
CREATE INDEX "document_acceptances_studentId_documentSlug_idx"
    ON "document_acceptances"("studentId", "documentSlug");

-- AddForeignKey
ALTER TABLE "document_acceptances"
    ADD CONSTRAINT "document_acceptances_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_acceptances"
    ADD CONSTRAINT "document_acceptances_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable RLS + deny-all policies (matching scripts/enable-rls.sql pattern)
ALTER TABLE "legal_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_acceptances" ENABLE ROW LEVEL SECURITY;

-- legal_documents: deny all for anon + authenticated (service_role bypasses)
CREATE POLICY "deny_all_anon" ON "legal_documents"
    FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_authenticated" ON "legal_documents"
    FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- document_acceptances: deny all for anon + authenticated (service_role bypasses)
CREATE POLICY "deny_all_anon" ON "document_acceptances"
    FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY "deny_all_authenticated" ON "document_acceptances"
    FOR ALL TO authenticated USING (false) WITH CHECK (false);
