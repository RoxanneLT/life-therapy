import { getAuthenticatedAdmin } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { adminUser } = await getAuthenticatedAdmin();

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar className="hidden lg:block" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader
          adminName={adminUser.name}
          adminEmail={adminUser.email}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
