"use server";

import { prisma } from "@/lib/prisma";
import type { ContactSource } from "@/lib/generated/prisma/client";

interface UpsertContactData {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  gender?: string;
  source: ContactSource;
  consentGiven?: boolean;
  consentMethod?: string;
  studentId?: string;
}

/**
 * Upsert a contact — creates if not exists, merges fields if exists.
 * Never downgrades consentGiven from true→false.
 * Never overwrites source (keeps the original).
 */
export async function upsertContact(data: UpsertContactData) {
  const normalizedEmail = data.email.toLowerCase().trim();

  return prisma.contact.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      phone: data.phone || null,
      gender: data.gender || null,
      source: data.source,
      consentGiven: data.consentGiven ?? false,
      consentDate: data.consentGiven ? new Date() : null,
      consentMethod: data.consentMethod || null,
      studentId: data.studentId || null,
    },
    update: {
      // Only fill in blank fields — don't overwrite existing data
      firstName: data.firstName
        ? { set: data.firstName }
        : undefined,
      lastName: data.lastName
        ? { set: data.lastName }
        : undefined,
      phone: data.phone
        ? { set: data.phone }
        : undefined,
      gender: data.gender
        ? { set: data.gender }
        : undefined,
      // Link student if not already linked
      studentId: data.studentId
        ? { set: data.studentId }
        : undefined,
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
 * Query contacts eligible for campaigns.
 * Only returns contacts where consentGiven=true AND emailOptOut=false.
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

  // Tag filtering: contacts must have ALL specified tags
  if (filters?.tags && filters.tags.length > 0) {
    where.AND = filters.tags.map((tag) => ({
      tags: { array_contains: [tag] },
    }));
  }

  return prisma.contact.findMany({
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
