/**
 * lib/audit.ts — Audit trail for sensitive operations
 *
 * Auth:   Server-only — called from server actions after requireRole
 * Data:   audit_logs table (append-only)
 * Notes:  PII-scrubbed before write. Fire-and-forget — never blocks the
 *         main operation. Requires the AuditLog Prisma model (see
 *         CLAUDE_PLATFORM_HARDENING.md Task 2 for the schema).
 */

import { createHmac } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Hash an IP for the audit trail. Keyed HMAC (not a bare hash) so the small IPv4
 * space can't be reversed by rainbow table, while the same IP still maps to the
 * same value — enough to correlate repeat offenders without storing raw PII.
 */
function hashIp(ip: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "lt-auth-ip-fallback-key";
  return createHmac("sha256", key).update(ip.trim()).digest("hex").slice(0, 16);
}

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
export type AuthEventAction =
  | "login_success"
  | "login_failure"
  | "password_reset_requested"
  | "password_changed";

/**
 * Record an authentication event (login, reset request, password change) to the
 * same audit trail. entityType is "auth"; the IP / user-agent / reason go in
 * metadata. Best-effort like recordAudit — never throws.
 */
export async function recordAuthEvent(input: {
  action: AuthEventAction;
  email: string;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  reason?: string;
}): Promise<void> {
  const email = input.email?.trim().toLowerCase() || "unknown";
  await recordAudit({
    action: input.action,
    entityType: "auth",
    entityId: input.userId || email,
    actorEmail: email,
    metadata: {
      ...(input.ip ? { ipHash: hashIp(input.ip) } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.reason ? { reason: input.reason } : {}),
    },
  });
}

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
