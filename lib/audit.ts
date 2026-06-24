/**
 * lib/audit.ts — Audit trail for sensitive operations
 *
 * Auth:   Server-only — called from server actions after requireRole
 * Data:   audit_logs table (append-only)
 * Notes:  PII-scrubbed before write. Fire-and-forget — never blocks the
 *         main operation. Requires the AuditLog Prisma model (see
 *         CLAUDE_PLATFORM_HARDENING.md Task 2 for the schema).
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export interface AuditInput {
  action: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

/** Fields that should NEVER appear in audit logs */
const SCRUB_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "secret",
  "confirmationToken",
  "resetToken",
  "apiKey",
  "clientSecret",
]);

function scrub(
  obj: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!obj) return null;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SCRUB_KEYS.has(key)) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Record an audit log entry. Best-effort — never throws, never blocks.
 *
 * Usage:
 *   await recordAudit({
 *     action: "billing_type_changed",
 *     entityType: "student",
 *     entityId: clientId,
 *     actorEmail: admin.email,
 *     before: { billingType: "prepaid" },
 *     after: { billingType: "postpaid" },
 *   });
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        actorEmail: input.actorEmail,
        before: (scrub(input.before) ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (scrub(input.after) ?? undefined) as Prisma.InputJsonValue | undefined,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Audit logging must never break the main operation
    console.error("[audit] Failed to write audit log:", err);
  }
}
