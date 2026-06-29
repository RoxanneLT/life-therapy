export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { getSiteSettings } from "@/lib/settings";
import { WhatsAppPanel } from "../whatsapp-panel";

export default async function WhatsAppSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  return (
    <WhatsAppPanel
      initialSettings={settings}
      whatsappTokenSet={!!process.env.WHATSAPP_ACCESS_TOKEN}
      embedded
      headerTitle="WhatsApp"
      headerDescription="WhatsApp Business messaging — reminders and notifications."
    />
  );
}
