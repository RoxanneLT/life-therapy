import { SettingsUsageRecorder } from "@/components/admin/settings/usage-recorder";

/**
 * Settings shell. The left nav is provided by the main AdminSidebar, which
 * swaps to the settings catalog (with a back-to-dashboard link) while inside
 * /admin/settings. Each page owns its sticky header + tabs; the body scrolls
 * beneath. The usage recorder feeds the Overview "Most used" cards.
 */
export default function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <SettingsUsageRecorder />
    </>
  );
}
