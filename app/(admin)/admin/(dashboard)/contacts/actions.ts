"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { upsertContact } from "@/lib/contacts";
import { Prisma } from "@/lib/generated/prisma/client";

export async function createContactAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  if (!email) throw new Error("Email is required");

  const tags = (formData.get("tags") as string)
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.contact.create({
    data: {
      email,
      firstName: (formData.get("firstName") as string)?.trim() || null,
      lastName: (formData.get("lastName") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      gender: (formData.get("gender") as string) || null,
      source: "manual",
      tags: tags.length > 0 ? tags : undefined,
      notes: (formData.get("notes") as string)?.trim() || null,
      consentGiven: formData.get("consentGiven") === "on",
      consentDate: formData.get("consentGiven") === "on" ? new Date() : null,
      consentMethod: formData.get("consentGiven") === "on" ? "manual_admin" : null,
    },
  });

  revalidatePath("/admin/contacts");
  redirect("/admin/contacts");
}

export async function updateContactAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Contact ID is required");

  const tags = (formData.get("tags") as string)
    ?.split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.contact.update({
    where: { id },
    data: {
      firstName: (formData.get("firstName") as string)?.trim() || null,
      lastName: (formData.get("lastName") as string)?.trim() || null,
      phone: (formData.get("phone") as string)?.trim() || null,
      gender: (formData.get("gender") as string) || null,
      tags: tags.length > 0 ? tags : Prisma.JsonNull,
      notes: (formData.get("notes") as string)?.trim() || null,
      emailOptOut: formData.get("emailOptOut") === "on",
    },
  });

  revalidatePath("/admin/contacts");
  revalidatePath(`/admin/contacts/${id}`);
  redirect(`/admin/contacts/${id}`);
}

export async function deleteContactAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const id = formData.get("id") as string;
  if (!id) throw new Error("Contact ID is required");

  await prisma.contact.delete({ where: { id } });

  revalidatePath("/admin/contacts");
  redirect("/admin/contacts");
}

export async function importContactsAction(
  rows: { email: string; firstName?: string; lastName?: string; phone?: string; gender?: string }[],
  options: { consentGiven: boolean; skipDrip: boolean; tags: string[] }
) {
  await requireRole("super_admin", "marketing");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.contact.findUnique({ where: { email } });

      await upsertContact({
        email,
        firstName: row.firstName?.trim() || undefined,
        lastName: row.lastName?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        gender: row.gender?.trim().toLowerCase() || undefined,
        source: "import",
        consentGiven: options.consentGiven,
        consentMethod: options.consentGiven
          ? "legitimate_interest_existing_client"
          : undefined,
      });

      // Apply tags if provided
      const contact = await prisma.contact.findUnique({ where: { email } });
      if (contact) {
        if (options.tags.length > 0) {
          const existingTags = (contact.tags as string[]) || [];
          const mergedTags = [...new Set([...existingTags, ...options.tags])];
          await prisma.contact.update({
            where: { id: contact.id },
            data: { tags: mergedTags },
          });
        }

        // Skip drip sequence: create a completed dripProgress record
        if (options.skipDrip) {
          await prisma.dripProgress.upsert({
            where: { contactId: contact.id },
            create: {
              contactId: contact.id,
              currentPhase: "newsletter",
              currentStep: 0,
              completedAt: new Date(),
            },
            update: {
              completedAt: new Date(),
            },
          });
        }
      }

      if (existing) {
        updated++;
      } else {
        created++;
      }
    } catch {
      skipped++;
    }
  }

  revalidatePath("/admin/contacts");
  return { created, updated, skipped, total: rows.length };
}

export async function getContactCountAction(filters?: {
  source?: string;
  tags?: string[];
}) {
  await requireRole("super_admin", "marketing");

  const where: Record<string, unknown> = {
    consentGiven: true,
    emailOptOut: false,
  };

  if (filters?.source) {
    where.source = filters.source;
  }

  return prisma.contact.count({ where });
}

export async function pauseDripAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const contactId = formData.get("contactId") as string;
  if (!contactId) throw new Error("Contact ID is required");

  await prisma.dripProgress.update({
    where: { contactId },
    data: { isPaused: true },
  });

  revalidatePath(`/admin/contacts/${contactId}`);
}

export async function resumeDripAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const contactId = formData.get("contactId") as string;
  if (!contactId) throw new Error("Contact ID is required");

  await prisma.dripProgress.update({
    where: { contactId },
    data: { isPaused: false },
  });

  revalidatePath(`/admin/contacts/${contactId}`);
}

export async function resetDripAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const contactId = formData.get("contactId") as string;
  if (!contactId) throw new Error("Contact ID is required");

  // Delete progress — cron will recreate at step 0 on next run
  await prisma.dripProgress.deleteMany({
    where: { contactId },
  });

  revalidatePath(`/admin/contacts/${contactId}`);
}
