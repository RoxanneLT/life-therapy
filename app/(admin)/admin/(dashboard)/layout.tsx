export const dynamic = "force-dynamic";

import { getAuthenticatedAdmin } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminProviders } from "@/components/providers/admin-providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { adminUser } = await getAuthenticatedAdmin();

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar role={adminUser.role} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader
          adminName={adminUser.name}
          adminEmail={adminUser.email}
          role={adminUser.role}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <AdminProviders>{children}</AdminProviders>
        </main>
      </div>
    </div>
  );
}
