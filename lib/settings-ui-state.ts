import { prisma } from "@/lib/prisma";

/**
 * Per-admin Settings "most used" tracking, stored in admin_users.settingsPageVisits
 * so it follows the user across devices. Server-only read helper; the bump is a
 * server action in the settings actions file.
 */
export async function getSettingsPageVisits(
  adminUserId: string,
): Promise<Record<string, number>> {
  const user = await prisma.adminUser.findUnique({
    where: { id: adminUserId },
    select: { settingsPageVisits: true },
  });
  const v = user?.settingsPageVisits;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, number>;
  }
  return {};
}
