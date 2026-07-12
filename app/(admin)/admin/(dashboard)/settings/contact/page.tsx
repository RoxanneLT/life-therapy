export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { isConfigured } from "@/lib/env";

const secretStatus = {
  msGraphConfigured: isConfigured("MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_SECRET"),
  smtpConfigured: isConfigured("SMTP_HOST", "SMTP_USER"),
  paystackConfigured: isConfigured("PAYSTACK_SECRET_KEY"),
  resendConfigured: isConfigured("RESEND_API_KEY"),
};

export default async function ContactSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  return (
    <SettingsForm
      initialSettings={settings}
      secretStatus={secretStatus}
      embeddedGroup="Contact"
      headerTitle="Contact & Locations"
      headerDescription="Contact details, office locations and business hours."
    />
  );
}
