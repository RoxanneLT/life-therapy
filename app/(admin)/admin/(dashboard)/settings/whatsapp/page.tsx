export const dynamic = "force-dynamic";

import { requireAccess } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { WhatsAppPanel } from "../whatsapp-panel";
import { isConfigured } from "@/lib/env";

export default async function WhatsAppSettingsPage() {
  await requireAccess("/admin/settings");
  const settings = await getSiteSettings();

  return (
    <WhatsAppPanel
      initialSettings={settings}
      whatsappTokenSet={isConfigured("WHATSAPP_ACCESS_TOKEN")}
      embedded
      headerTitle="WhatsApp"
      headerDescription="WhatsApp Business messaging — reminders and notifications."
    />
  );
}
