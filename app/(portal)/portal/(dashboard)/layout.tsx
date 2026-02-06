export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { PortalHeader } from "@/components/portal/portal-header";

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { student } = await requirePasswordChanged();

  return (
    <div className="flex h-screen overflow-hidden">
      <PortalSidebar className="hidden lg:block" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <PortalHeader
          studentName={`${student.firstName} ${student.lastName}`}
          studentEmail={student.email}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
