export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

const secretStatus = {
  msGraphConfigured: !!(process.env.MS_GRAPH_TENANT_ID && process.env.MS_GRAPH_CLIENT_SECRET),
  smtpConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
  paystackConfigured: !!process.env.PAYSTACK_SECRET_KEY,
  resendConfigured: !!process.env.RESEND_API_KEY,
};

export default async function MarketingSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  return (
    <SettingsForm
      initialSettings={settings}
      secretStatus={secretStatus}
      embeddedGroup="Marketing"
      headerTitle="Marketing"
      headerDescription="Social links, SEO & analytics, and newsletter."
    />
  );
}
