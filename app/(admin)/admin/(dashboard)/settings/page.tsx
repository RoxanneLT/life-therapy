export const dynamic = "force-dynamic";

import { getSiteSettings } from "@/lib/settings";
import { requireRole } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  return <SettingsForm initialSettings={settings} />;
}
