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
 *
 * **Fails closed.** This used to fall back to a literal key committed to this
 * repo (`… || "lt-auth-fallback-key"`), which defeated the entire point: IPv4 is
 * only 2^32 values, so with a public key anyone holding the source could reverse
 * every "hashed" IP by brute force in minutes. A privacy guard that silently
 * degrades to no guard is worse than none, because the column still *looks*
 * protected. If the key is missing we throw rather than write a reversible hash.
 *
 * It also no longer borrows SUPABASE_SERVICE_ROLE_KEY — overloading one secret
 * for an unrelated purpose means rotating it silently re-keys the audit trail,
 * and every previously-stored hash stops correlating.
 */
function hashIp(ip: string): string | null {
  const key = process.env.AUDIT_IP_HMAC_KEY;
  if (!key) {
    // Return null, don't throw: recordAuthEvent's contract is "never throws", and
    // hashIp is evaluated while BUILDING recordAudit's argument — outside its
    // try/catch — so a throw here would escape into the login path and take auth
    // down. Fail closed on the HASH (write none), not on the request.
    console.error(
      "[audit] AUDIT_IP_HMAC_KEY is not set — recording this auth event WITHOUT an " +
        "IP hash. Set it (any long random string); an unkeyed hash of an IPv4 " +
        "address is reversible by brute force and offers no privacy at all.",
    );
    return null;
  }
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
  | "password_changed"
  // The second factor is the half that stops a stolen password, and it left no
  // trace at all — a run of failed codes against an account was invisible.
  | "mfa_success"
  | "mfa_failure";

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
  const ipHash = input.ip ? hashIp(input.ip) : null;
  await recordAudit({
    action: input.action,
    entityType: "auth",
    entityId: input.userId || email,
    actorEmail: email,
    metadata: {
      // Omit the field entirely when the key is unset — never write `ipHash: null`,
      // which reads like "no IP was seen" rather than "we refused to fake-protect one".
      ...(ipHash ? { ipHash } : {}),
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
