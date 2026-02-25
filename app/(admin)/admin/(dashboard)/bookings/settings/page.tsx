export const dynamic = "force-dynamic";

import { getSiteSettings } from "@/lib/settings";
import { requireRole } from "@/lib/auth";
import { BookingSettingsForm } from "@/components/admin/booking-settings-form";

export default async function BookingSettingsPage() {
  await requireRole("super_admin");
  const settings = await getSiteSettings();

  const msGraphConfigured = !!(process.env.MS_GRAPH_TENANT_ID && process.env.MS_GRAPH_CLIENT_SECRET);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Booking Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure scheduling rules and Microsoft 365 calendar integration.
        </p>
      </div>
      <BookingSettingsForm initialSettings={settings} msGraphConfigured={msGraphConfigured} />
    </div>
  );
}
