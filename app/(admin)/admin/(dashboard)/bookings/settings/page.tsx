export const dynamic = "force-dynamic";

import { getSiteSettings } from "@/lib/settings";
import { PageHeader } from "@/components/admin/page-header";
import { requireAccess } from "@/lib/auth";
import { BookingSettingsForm } from "@/components/admin/booking-settings-form";
import { isConfigured } from "@/lib/env";

export default async function BookingSettingsPage() {
  await requireAccess("/admin/bookings/settings");
  const settings = await getSiteSettings();

  const msGraphConfigured = isConfigured("MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_SECRET");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking Settings"
        description="Configure scheduling rules and Microsoft 365 calendar integration."
      />
      <BookingSettingsForm initialSettings={settings} msGraphConfigured={msGraphConfigured} />
    </div>
  );
}
