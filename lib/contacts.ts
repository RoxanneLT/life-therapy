/**
 * Contact/audience helpers. A LIBRARY, not an actions file.
 *
 * The `"use server"` directive was removed deliberately. At the top of a file it
 * turns EVERY export into a server-action endpoint that any client component can
 * invoke by importing it — and `upsertContact` writes to `students` with no auth
 * guard of its own. It was never exploitable (all six importers are server-side:
 * server actions and route handlers, each already guarded or rate-limited), but
 * the directive made it an unguarded endpoint in waiting, and it was invisible to
 * the audit's server-action check, which only walks `app/**\/actions.ts`.
 *
 * These are plain async functions. Callers are server code and call them directly.
 * If you ever need one of these FROM a client component, wrap it in a real
 * `actions.ts` with a `requireRole`/`getAuthenticatedStudent` guard — do not put
 * the directive back.
 */
import { prisma } from "@/lib/prisma";
import type { AudienceFilters } from "@/lib/audience-filters";
import { normalizePhoneForStorage } from "@/lib/phone";
import { maskName, recordAudit } from "@/lib/audit";

interface UpsertContactData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  source: string;
  consentGiven?: boolean;
  consentMethod?: string;
}

/** What a contact created without a name is called. It counts as blank, so a real name can replace it. */
const PLACEHOLDER_FIRST_NAME = "Friend";

const isBlank = (v: string | null | undefined): boolean => !v || !v.trim();
const sameText = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Upsert a client (Student record): creates one if the address is new, otherwise FILLS ONLY BLANK
 * FIELDS. Never downgrades consentGiven from true to false. Never overwrites source.
 *
 * Why fill-blank only (owner's ruling, 2026-10-09): the existing record is curated client data, and
 * every caller hands this unauthenticated or bulk input (the public booking form, the newsletter
 * footer, a CSV import). "Ann" on a newsletter signup must never rename the client "Anne". Until
 * 2026-10-09 the code overwrote any field a new value arrived for, while this comment said it
 * didn't. Deliberate changes go through the admin client page or the client's own portal.
 *
 * A non-blank incoming value that DIFFERS from the stored one is not silently dropped: it is
 * recorded as a `contact_field_conflict` audit entry, so a genuine change of number can be found.
 * Names are recorded as initials and gender in full. Phone is recorded as differing, never by value,
 * because the column is encrypted and the audit log is not; the booking path stores the new number,
 * encrypted, on the booking itself. Names were stored in full until 2026-10-10, when the owner ruled
 * that audit_logs, which is append-only and outlives a POPIA erasure, must not hold them.
 *
 * For newsletter-only subscribers, creates a Student without a Supabase auth account
 * (supabaseUserId = null). They become full portal users when they later book/register.
 */
export async function upsertContact(data: UpsertContactData) {
  const normalizedEmail = data.email.toLowerCase().trim();
  const normalizedPhone = normalizePhoneForStorage(data.phone);

  const existing = await prisma.student.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, firstName: true, lastName: true, phone: true, gender: true },
  });

  const fill: { firstName?: string; lastName?: string; phone?: string; gender?: string } = {};
  const conflicts: Record<string, { stored: string; incoming: string }> = {};
  const asIs = (v: string) => v;
  const unrecorded = { stored: "[encrypted]", incoming: "[differs — not recorded]" };
  const offer = (field: keyof typeof fill, incoming: string | null | undefined, stored: string | null | undefined, blank: boolean, record: ((v: string) => string) | null = asIs) => {
    if (isBlank(incoming)) return;
    if (blank) fill[field] = incoming!;
    else if (!sameText(stored!, incoming!)) conflicts[field] = record ? { stored: record(stored!), incoming: record(incoming!) } : unrecorded;
  };
  if (existing) {
    offer("firstName", data.firstName, existing.firstName, isBlank(existing.firstName) || existing.firstName === PLACEHOLDER_FIRST_NAME, maskName);
    offer("lastName", data.lastName, existing.lastName, isBlank(existing.lastName), maskName);
    offer("phone", normalizedPhone, existing.phone, isBlank(existing.phone), null);
    offer("gender", data.gender, existing.gender, isBlank(existing.gender));
  }

  const student = await prisma.student.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      firstName: data.firstName || PLACEHOLDER_FIRST_NAME,
      lastName: data.lastName || "",
      phone: normalizedPhone,
      gender: data.gender || null,
      source: data.source,
      clientStatus: "potential",
      consentGiven: data.consentGiven ?? false,
      consentDate: data.consentGiven ? new Date() : null,
      consentMethod: data.consentMethod || null,
    },
    update: {
      ...fill,
      // Never downgrade consent — only upgrade from false to true
      ...(data.consentGiven
        ? {
            consentGiven: true,
            consentDate: new Date(),
            consentMethod: data.consentMethod || undefined,
          }
        : {}),
    },
  });

  if (existing && Object.keys(conflicts).length > 0) {
    await recordAudit({
      action: "contact_field_conflict",
      entityType: "student",
      entityId: existing.id,
      actorEmail: "system",
      metadata: { source: data.source, kept: "stored", fields: conflicts },
    });
  }

  return student;
}

// ── Helper: parse "7d" / "30d" / "90d" into a Date ──
function parseLoginRange(range: string): Date | null {
  const match = range.match(/^(\d+)d$/);
  if (!match) return null;
  const days = Number.parseInt(match[1], 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ── Helper: calculate DOB range from age range ──
function ageToDobRange(ageRange: { min?: number; max?: number }): {
  dobAfter?: Date;
  dobBefore?: Date;
} {
  const now = new Date();
  const result: { dobAfter?: Date; dobBefore?: Date } = {};

  if (ageRange.max !== undefined) {
    // Max age → born AFTER this date
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - ageRange.max - 1);
    d.setDate(d.getDate() + 1);
    result.dobAfter = d;
  }
  if (ageRange.min !== undefined) {
    // Min age → born BEFORE this date
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - ageRange.min);
    result.dobBefore = d;
  }
  return result;
}

/**
 * Query clients (Students) eligible for campaigns.
 * Only returns students where consentGiven=true AND emailOptOut=false.
 *
 * Supports both legacy filters (source/tags/clientStatus strings)
 * and new AudienceFilters object.
 */
export async function getCampaignRecipients(
  filters?: {
    // Legacy support
    source?: string;
    tags?: string[];
    clientStatus?: string;
  },
  audienceFilters?: AudienceFilters
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    consentGiven: true,
    emailOptOut: false,
    emailPaused: false,
  };

  const andConditions: Record<string, unknown>[] = [];

  // ── Use audienceFilters if present, otherwise fall back to legacy ──

  if (audienceFilters && Object.keys(audienceFilters).length > 0) {
    const af = audienceFilters;

    // Source (array — OR)
    if (af.source && af.source.length > 0) {
      where.source = { in: af.source };
    }

    // Client status (array — OR)
    if (af.clientStatus && af.clientStatus.length > 0) {
      where.clientStatus = { in: af.clientStatus };
    }

    // Gender (array — OR)
    if (af.gender && af.gender.length > 0) {
      where.gender = { in: af.gender };
    }

    // Age range (via DOB)
    if (af.ageRange && (af.ageRange.min !== undefined || af.ageRange.max !== undefined)) {
      const { dobAfter, dobBefore } = ageToDobRange(af.ageRange);
      const dobFilter: Record<string, Date> = {};
      if (dobAfter) dobFilter.gte = dobAfter;
      if (dobBefore) dobFilter.lte = dobBefore;
      if (Object.keys(dobFilter).length > 0) {
        where.dateOfBirth = dobFilter;
      }
    }

    // Last login
    if (af.lastLoginRange) {
      if (af.lastLoginRange === "never") {
        // Never logged in = no supabaseUserId
        where.supabaseUserId = null;
      } else {
        const sinceDate = parseLoginRange(af.lastLoginRange);
        if (sinceDate) {
          const direction = af.lastLoginDirection || "within";
          if (direction === "within") {
            where.updatedAt = { gte: sinceDate };
          } else {
            where.updatedAt = { lt: sinceDate };
          }
        }
      }
    }

    // Relationship status (array — OR)
    if (af.relationshipStatus && af.relationshipStatus.length > 0) {
      where.relationshipStatus = { in: af.relationshipStatus };
    }

    // Has partner linked
    if (af.hasPartnerLinked === true) {
      andConditions.push({
        OR: [
          { relationshipsFrom: { some: { relationshipType: "partner" } } },
          { relationshipsTo: { some: { relationshipType: "partner" } } },
        ],
      });
    }

    // Assessment — behaviours
    if (af.behaviours && af.behaviours.length > 0) {
      const matchAll = af.assessmentMatchMode === "all";
      if (matchAll) {
        // All selected behaviours must be present
        for (const b of af.behaviours) {
          andConditions.push({
            intake: { behaviours: { has: b } },
          });
        }
      } else {
        // Any of the selected behaviours
        andConditions.push({
          intake: { behaviours: { hasSome: af.behaviours } },
        });
      }
    }

    // Assessment — feelings
    if (af.feelings && af.feelings.length > 0) {
      const matchAll = af.assessmentMatchMode === "all";
      if (matchAll) {
        for (const f of af.feelings) {
          andConditions.push({
            intake: { feelings: { has: f } },
          });
        }
      } else {
        andConditions.push({
          intake: { feelings: { hasSome: af.feelings } },
        });
      }
    }

    // Assessment — symptoms
    if (af.symptoms && af.symptoms.length > 0) {
      const matchAll = af.assessmentMatchMode === "all";
      if (matchAll) {
        for (const s of af.symptoms) {
          andConditions.push({
            intake: { symptoms: { has: s } },
          });
        }
      } else {
        andConditions.push({
          intake: { symptoms: { hasSome: af.symptoms } },
        });
      }
    }

    // Onboarding complete
    if (af.onboardingComplete === true) {
      where.onboardingStep = { gte: 3 };
    }

    // Has enrollments
    if (af.hasEnrollments === true) {
      andConditions.push({
        enrollments: { some: {} },
      });
    }

    // Has no enrollments
    if (af.hasNoEnrollments === true) {
      andConditions.push({
        enrollments: { none: {} },
      });
    }

    // Legacy tags support in audienceFilters
    if (af.tags && af.tags.length > 0) {
      for (const tag of af.tags) {
        andConditions.push({
          tags: { path: [], array_contains: [tag] },
        });
      }
    }
  } else if (filters) {
    // ── Legacy filter path ──
    if (filters.source) {
      where.source = filters.source;
    }
    if (filters.clientStatus) {
      where.clientStatus = filters.clientStatus;
    }
    if (filters.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        andConditions.push({
          tags: { path: [], array_contains: [tag] },
        });
      }
    }
  }

  // Apply AND conditions
  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return prisma.student.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      unsubscribeToken: true,
      supabaseUserId: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
