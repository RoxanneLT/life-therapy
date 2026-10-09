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

/**
 * A client's contact details are masked, not stored. audit_logs is append-only (80_ops.sql) and
 * outlives a POPIA erasure, so whatever lands here stays for good: an email change recorded both
 * addresses in full until 2026-10-09. A masked value still tells a reader which address it was.
 *
 * Admin accounts and auth events keep theirs. Who held admin access, and which account a sign-in
 * targeted, is the accountability record itself. Only top-level keys are masked: the contact
 * conflict entry nests names under `fields` on purpose, so an admin can apply a genuine change.
 */
const KEEPS_CONTACT_DETAILS = new Set(["admin_user", "auth"]);
const EMAIL_KEY = /email$/i;
const NAME_KEY = /^(?:first|last|client|couplesPartner|partner|recipient|guardian)Name$/;
const PHONE_KEY = /phone$/i;

function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

function maskName(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}.`).join(" ");
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 2 ? `***${digits.slice(-2)}` : "***";
}

function mask(key: string, value: unknown): unknown {
  if (typeof value !== "string" || value === "") return value;
  if (EMAIL_KEY.test(key)) return maskEmail(value);
  if (NAME_KEY.test(key)) return maskName(value);
  if (PHONE_KEY.test(key)) return maskPhone(value);
  return value;
}

function scrub(
  obj: Record<string, unknown> | null | undefined,
  entityType: string,
): Record<string, unknown> | null {
  if (!obj) return null;
  const masks = !KEEPS_CONTACT_DETAILS.has(entityType);
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SCRUB_KEYS.has(key)) continue;
    cleaned[key] = masks ? mask(key, value) : value;
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
        before: (scrub(input.before, input.entityType) ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (scrub(input.after, input.entityType) ?? undefined) as Prisma.InputJsonValue | undefined,
        metadata: (scrub(input.metadata, input.entityType) ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Audit logging must never break the main operation. But a gap in the trail must not be
    // silent either: until 2026-10-09 a failure reached a Vercel log line and nobody. It is now a
    // failed cron_runs row, which the daily digest already reports (collectCronRunFailures). If
    // the database itself is down, that write fails too and the log line is all there is.
    console.error("[audit] Failed to write audit log:", err);
    await reportAuditGap(input, err);
  }
}

async function reportAuditGap(input: AuditInput, err: unknown): Promise<void> {
  const reason = err instanceof Error ? err.message.split("\n").find((l) => l.trim()) ?? err.name : String(err);
  // An auth event's entityId can be the email address, so it is left out there.
  const subject = input.entityType === "auth" ? "auth" : `${input.entityType} ${input.entityId}`;
  try {
    await prisma.cronRun.create({
      data: {
        jobName: "audit-write",
        status: "failed",
        finishedAt: new Date(),
        // The action and the record it concerns, never the before/after values.
        errorMessage: `${input.action} on ${subject} was not recorded: ${reason.slice(0, 200)}`,
      },
    });
  } catch (gapErr) {
    console.error("[audit] Could not report the gap either:", gapErr);
  }
}
