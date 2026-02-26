export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalHeader } from "@/components/portal/portal-header";
import { getOutstandingDocuments } from "@/lib/legal-documents";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { student } = await requirePasswordChanged();

  // Document gate: redirect to review page if outstanding documents exist.
  // Only applies after onboarding is complete (step >= 3).
  // review-documents lives outside (dashboard) to avoid this gate.
  if (student.onboardingStep >= 3) {
    const outstanding = await getOutstandingDocuments(student.id);
    if (outstanding.length > 0) {
      redirect("/portal/review-documents");
    }
  }

  const [upcomingCount, anyBooking, creditBalance] = await Promise.all([
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
  ]);

  const isSessionsClient = !!anyBooking || (creditBalance?.balance ?? 0) > 0;

  return (
    <div className="flex h-screen overflow-hidden">
      <PortalSidebar className="hidden lg:block" upcomingSessionCount={upcomingCount} isSessionsClient={isSessionsClient} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PortalHeader
          studentName={`${student.firstName} ${student.lastName}`}
          studentEmail={student.email}
          upcomingSessionCount={upcomingCount}
          isSessionsClient={isSessionsClient}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
