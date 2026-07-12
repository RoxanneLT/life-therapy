export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { isConfigured } from "@/lib/env";

export default async function IntegrationsSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  const secretStatus = {
    msGraphConfigured: isConfigured("MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_SECRET"),
    smtpConfigured: isConfigured("SMTP_HOST", "SMTP_USER"),
    paystackConfigured: isConfigured("PAYSTACK_SECRET_KEY"),
    resendConfigured: isConfigured("RESEND_API_KEY"),
  };

  return (
    <SettingsForm
      initialSettings={settings}
      secretStatus={secretStatus}
      embeddedGroup="Integrations"
      headerTitle="Integrations"
      headerDescription="Email, newsletter, payments and calendar connections."
    />
  );
}
