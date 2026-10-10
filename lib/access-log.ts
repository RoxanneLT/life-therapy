import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

/**
 * Record that an admin LOOKED at a client's sensitive data, or took a copy of it. Until
 * 2026-10-09 the audit trail held changes only, so nobody could say who had read a client's
 * assessment or session notes, or who had exported the whole client list (census,
 * .handoff/data-access-logging/01-census.md). Scope, by the owner's ruling: clinical views and
 * every export.
 *
 * A view is recorded once per admin per record per ten minutes. A page re-renders on every
 * revalidatePath after an edit, and a row per render would bury the reads that matter.
 * Exports are never collapsed: each one is a copy leaving the system.
 */
const VIEW_WINDOW_MS = 10 * 60 * 1000;

export async function recordView(input: {
  actorEmail: string;
  entityType: "student" | "booking";
  entityId: string;
  area: string;
}): Promise<void> {
  const action = `${input.entityType}_record_viewed`;
  try {
    const recent = await prisma.auditLog.findFirst({
      where: {
        action,
        entityId: input.entityId,
        actorEmail: input.actorEmail,
        createdAt: { gte: new Date(Date.now() - VIEW_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (recent) return;
  } catch (err) {
    console.error("[access-log] could not check for a recent view:", err);
  }
  await recordAudit({ action, entityType: input.entityType, entityId: input.entityId, actorEmail: input.actorEmail, metadata: { area: input.area } });
}

/**
 * recordView for a page that shows many records at once (the bookings calendar hands a clinical
 * role the notes of every session in range). One row per record, so each client's trail says who
 * saw their notes, in two queries rather than two per record. Same ten-minute window.
 */
export async function recordViews(input: { actorEmail: string; entityType: "booking"; entityIds: string[]; area: string }): Promise<void> {
  if (input.entityIds.length === 0) return;
  const action = `${input.entityType}_record_viewed`;
  let seen = new Set<string>();
  try {
    const recent = await prisma.auditLog.findMany({
      where: {
        action,
        entityId: { in: input.entityIds },
        actorEmail: input.actorEmail,
        createdAt: { gte: new Date(Date.now() - VIEW_WINDOW_MS) },
      },
      select: { entityId: true },
    });
    seen = new Set(recent.map((r) => r.entityId));
  } catch (err) {
    console.error("[access-log] could not check for recent views:", err);
  }
  const fresh = input.entityIds.filter((id) => !seen.has(id));
  if (fresh.length === 0) return;
  try {
    await prisma.auditLog.createMany({
      data: fresh.map((entityId) => ({ action, entityType: input.entityType, entityId, actorEmail: input.actorEmail, metadata: { area: input.area } })),
    });
  } catch {
    // One by one through recordAudit, which reports each row it cannot write as a gap.
    await Promise.all(fresh.map((entityId) => recordAudit({ action, entityType: input.entityType, entityId, actorEmail: input.actorEmail, metadata: { area: input.area } })));
  }
}

export async function recordExport(input: { actorEmail: string; report: string; rows: number; filters?: Record<string, unknown> }): Promise<void> {
  await recordAudit({
    action: "data_exported",
    entityType: "export",
    entityId: input.report,
    actorEmail: input.actorEmail,
    metadata: { rows: input.rows, ...(input.filters ? { filters: input.filters } : {}) },
  });
}
