"use server";

import { prisma } from "@/lib/prisma";

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

/**
 * Query clients (Students) eligible for campaigns.
 * Only returns students where consentGiven=true AND emailOptOut=false.
 */
export async function getCampaignRecipients(filters?: {
  source?: string;
  tags?: string[];
}) {
  const where: Record<string, unknown> = {
    consentGiven: true,
    emailOptOut: false,
    emailPaused: false,
  };

  if (filters?.source) {
    where.source = filters.source;
  }

  // Tag filtering: clients must have ALL specified tags
  if (filters?.tags && filters.tags.length > 0) {
    where.AND = filters.tags.map((tag) => ({
      tags: { array_contains: [tag] },
    }));
  }

  return prisma.student.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      unsubscribeToken: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
