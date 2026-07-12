export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { WhatsAppPanel } from "../whatsapp-panel";
import { isConfigured } from "@/lib/env";

export default async function WhatsAppSettingsPage() {
  await requireRole("super_admin");
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
