"use server";

import { prisma } from "@/lib/prisma";
import type { AudienceFilters } from "@/lib/audience-filters";

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

/**
 * Upsert a client (Student record) — creates if not exists, merges fields if exists.
 * Never downgrades consentGiven from true→false.
 * Never overwrites source (keeps the original).
 *
 * For newsletter-only subscribers, creates a Student without a Supabase auth account
 * (supabaseUserId = null). They become full portal users when they later book/register.
 */
export async function upsertContact(data: UpsertContactData) {
  const normalizedEmail = data.email.toLowerCase().trim();

  return prisma.student.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      firstName: data.firstName || "Friend",
      lastName: data.lastName || "",
      phone: data.phone || null,
      gender: data.gender || null,
      source: data.source,
      clientStatus: "potential",
      consentGiven: data.consentGiven ?? false,
      consentDate: data.consentGiven ? new Date() : null,
      consentMethod: data.consentMethod || null,
    },
    update: {
      // Only fill in blank fields — don't overwrite existing data
      ...(data.firstName ? { firstName: data.firstName } : {}),
      ...(data.lastName ? { lastName: data.lastName } : {}),
      ...(data.phone ? { phone: data.phone } : {}),
      ...(data.gender ? { gender: data.gender } : {}),
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
