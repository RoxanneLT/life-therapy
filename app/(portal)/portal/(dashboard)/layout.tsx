export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalHeader } from "@/components/portal/portal-header";
import { getOutstandingDocuments, getActiveDocument } from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";
import { DocumentUpdateModal } from "@/components/portal/document-update-modal";

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { student } = await requirePasswordChanged();

  // Document gate: show modal if outstanding documents exist.
  // Only applies after onboarding is complete (step >= 3).
  let outstandingDocuments: { slug: string; title: string; content: { heading: string; content: string }[]; version: number; changeSummary: string | null }[] = [];
  if (student.onboardingStep >= 3) {
    const outstanding = await getOutstandingDocuments(student.id);
    if (outstanding.length > 0) {
      const docs = await Promise.all(outstanding.map((slug) => getActiveDocument(slug)));
      outstandingDocuments = docs.filter(Boolean).map((doc) => ({
        slug: doc!.slug,
        title: doc!.title,
        content: doc!.content as { heading: string; content: string }[],
        version: doc!.version,
        changeSummary: doc!.changeSummary,
      }));
    }
  }

  const [upcomingCount, anyBooking, creditBalance, certificateCount] = await Promise.all([
    prisma.booking.count({
      where: {
        studentId: student.id,
        status: { in: ["pending", "confirmed"] },
        date: { gte: new Date() },
      },
    }),
    prisma.booking.findFirst({
      where: { studentId: student.id },
      select: { id: true },
    }),
    prisma.sessionCreditBalance.findUnique({
      where: { studentId: student.id },
      select: { balance: true },
    }),
    prisma.certificate.count({
      where: { studentId: student.id },
    }),
  ]);

  const isSessionsClient = !!anyBooking || (creditBalance?.balance ?? 0) > 0;

  return (
    <div className="flex h-screen overflow-hidden">
      <PortalSidebar className="hidden lg:block" upcomingSessionCount={upcomingCount} isSessionsClient={isSessionsClient} certificateCount={certificateCount} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PortalHeader
          studentName={`${student.firstName} ${student.lastName}`}
          studentEmail={student.email}
          upcomingSessionCount={upcomingCount}
          isSessionsClient={isSessionsClient}
          certificateCount={certificateCount}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
      {outstandingDocuments.length > 0 && (
        <DocumentUpdateModal documents={outstandingDocuments} />
      )}
    </div>
  );
}
