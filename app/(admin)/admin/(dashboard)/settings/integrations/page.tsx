export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function IntegrationsSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  const secretStatus = {
    msGraphConfigured: !!(process.env.MS_GRAPH_TENANT_ID && process.env.MS_GRAPH_CLIENT_SECRET),
    smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    paystackConfigured: !!process.env.PAYSTACK_SECRET_KEY,
    resendConfigured: !!process.env.RESEND_API_KEY,
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
