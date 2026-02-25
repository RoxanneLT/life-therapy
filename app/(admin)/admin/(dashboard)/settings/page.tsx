export const dynamic = "force-dynamic";

import { getSiteSettings } from "@/lib/settings";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/admin/settings-form";
import { SettingsTabs } from "./settings-tabs";
import { UsersPanel } from "./users-panel";

interface Props {
  readonly searchParams: Promise<{ tab?: string }>;
}

export default async function AdminSettingsPage({ searchParams }: Props) {
  await requireRole("super_admin");
  const { tab } = await searchParams;
  const activeTab = tab === "users" ? "users" : "settings";

  const settings = await getSiteSettings();

  const secretStatus = {
    msGraphConfigured: !!(process.env.MS_GRAPH_TENANT_ID && process.env.MS_GRAPH_CLIENT_SECRET),
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    paystackConfigured: !!process.env.PAYSTACK_SECRET_KEY,
    resendConfigured: !!process.env.RESEND_API_KEY,
  };

  // Only fetch users if on the users tab
  const users = activeTab === "users"
    ? await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } })
    : [];

  const serializedUsers = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <SettingsTabs activeTab={activeTab} />
      {activeTab === "settings" && <SettingsForm initialSettings={settings} secretStatus={secretStatus} />}
      {activeTab === "users" && <UsersPanel users={serializedUsers} />}
    </div>
  );
}
