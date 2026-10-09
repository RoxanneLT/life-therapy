export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CalendarSyncSection } from "../calendar-sync-section";
import { PageHeader } from "@/components/admin/page-header";

export default async function CalendarSyncSettingsPage() {
  await requireRole("super_admin");

  const [logs, lastReconcile] = await Promise.all([
    prisma.calendarSyncLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.calendarSyncLog.findFirst({
      where: { operation: "reconcile" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const recentLogs = logs.map((l) => ({
    id: l.id,
    operation: l.operation,
    status: l.status,
    graphEventId: l.graphEventId,
    errorMessage: l.errorMessage,
    metadata: l.metadata as Record<string, unknown> | null,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <>
      <PageHeader
        sticky
        back={{ href: "/admin/settings", to: "Settings" }}
        title="Calendar Sync"
        description="Keep Outlook / Teams in sync with the Portal — connection check, reconcile and activity."
      />
      <CalendarSyncSection
        recentLogs={recentLogs}
        lastReconcileResult={(lastReconcile?.metadata as Record<string, unknown> | null) ?? null}
        lastReconcileAt={lastReconcile?.createdAt.toISOString() ?? null}
      />
    </>
  );
}
