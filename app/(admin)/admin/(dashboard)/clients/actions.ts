"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, getAuthenticatedAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { upsertContact } from "@/lib/contacts";
import { createOrderNumber } from "@/lib/order";
import { addCredits } from "@/lib/credits";
import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";

// ────────────────────────────────────────────────────────────
// Update admin notes on a client
// ────────────────────────────────────────────────────────────

export async function updateAdminNotesAction(clientId: string, notes: string) {
  await requireRole("super_admin", "marketing");

  await prisma.student.update({
    where: { id: clientId },
    data: { adminNotes: notes.trim() || null },
  });

  revalidatePath(`/admin/clients/${clientId}`);
}

// ────────────────────────────────────────────────────────────
// Update client profile fields
// ────────────────────────────────────────────────────────────

export async function updateClientProfileAction(clientId: string, formData: FormData) {
  await requireRole("super_admin");

  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  if (!firstName || !lastName) throw new Error("First name and last name are required");

  const phone = (formData.get("phone") as string)?.trim() || null;
  const gender = (formData.get("gender") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const relationshipStatus = (formData.get("relationshipStatus") as string)?.trim() || null;
  const emergencyContact = (formData.get("emergencyContact") as string)?.trim() || null;
  const referralSource = (formData.get("referralSource") as string)?.trim() || null;
  const referralDetail = (formData.get("referralDetail") as string)?.trim() || null;
  const dateOfBirth = (formData.get("dateOfBirth") as string)?.trim() || null;

  // Communication preferences (checkboxes)
  const newsletterOptIn = formData.get("newsletterOptIn") === "on";
  const marketingOptIn = formData.get("marketingOptIn") === "on";
  const smsOptIn = formData.get("smsOptIn") === "on";
  const sessionReminders = formData.get("sessionReminders") === "on";

  await prisma.student.update({
    where: { id: clientId },
    data: {
      firstName,
      lastName,
      phone,
      gender,
      address,
      relationshipStatus,
      emergencyContact,
      referralSource,
      referralDetail,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      newsletterOptIn,
      marketingOptIn,
      smsOptIn,
      sessionReminders,
    },
  });

  revalidatePath(`/admin/clients/${clientId}`);
}

// ────────────────────────────────────────────────────────────
// Update client status
// ────────────────────────────────────────────────────────────

export async function updateClientStatusAction(clientId: string, status: string) {
  await requireRole("super_admin");

  const validStatuses = ["potential", "active", "inactive", "archived"];
  if (!validStatuses.includes(status)) throw new Error("Invalid status");

  const data: Record<string, unknown> = { clientStatus: status };
  if (status === "active") {
    const student = await prisma.student.findUnique({ where: { id: clientId }, select: { convertedAt: true } });
    if (!student?.convertedAt) {
      data.convertedAt = new Date();
    }
  }

  await prisma.student.update({ where: { id: clientId }, data });

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
}

// ────────────────────────────────────────────────────────────
// Convert potential client → active
// ────────────────────────────────────────────────────────────

interface ConvertData {
  hybridPackageId?: string;
  credits?: number;
  adminNotes?: string;
  behaviours?: string[];
  feelings?: string[];
  symptoms?: string[];
}

export async function convertToClientAction(clientId: string, data: ConvertData) {
  const { adminUser } = await getAuthenticatedAdmin();
  await requireRole("super_admin");

  const client = await prisma.student.findUnique({
    where: { id: clientId },
    select: { clientStatus: true, email: true, firstName: true, lastName: true },
  });
  if (!client) throw new Error("Client not found");
  if (client.clientStatus !== "potential") throw new Error("Client is not in 'potential' status");

  // 1. Update status to active
  await prisma.student.update({
    where: { id: clientId },
    data: {
      clientStatus: "active",
      convertedAt: new Date(),
      convertedBy: adminUser.id,
      ...(data.adminNotes ? { adminNotes: data.adminNotes.trim() } : {}),
    },
  });

  // 2. Save assessment chips if provided
  const hasAssessment =
    (data.behaviours && data.behaviours.length > 0) ||
    (data.feelings && data.feelings.length > 0) ||
    (data.symptoms && data.symptoms.length > 0);

  if (hasAssessment) {
    await prisma.clientIntake.upsert({
      where: { studentId: clientId },
      create: {
        studentId: clientId,
        behaviours: data.behaviours || [],
        feelings: data.feelings || [],
        symptoms: data.symptoms || [],
        lastEditedBy: "admin",
        lastEditedAt: new Date(),
      },
      update: {
        behaviours: data.behaviours || [],
        feelings: data.feelings || [],
        symptoms: data.symptoms || [],
        lastEditedBy: "admin",
        lastEditedAt: new Date(),
      },
    });
  }

  // 3. Handle package / credits
  let creditsGranted = 0;

  if (data.hybridPackageId) {
    const pkg = await prisma.hybridPackage.findUnique({
      where: { id: data.hybridPackageId },
    });
    if (!pkg) throw new Error("Package not found");

    const orderNumber = await createOrderNumber();
    await prisma.order.create({
      data: {
        orderNumber,
        studentId: clientId,
        status: "paid",
        paidAt: new Date(),
        subtotalCents: 0,
        totalCents: 0,
        currency: "ZAR",
        items: {
          create: {
            hybridPackageId: pkg.id,
            description: `${pkg.title} (admin conversion grant)`,
            unitPriceCents: 0,
            quantity: 1,
            totalCents: 0,
          },
        },
      },
    });

    if (pkg.credits > 0) {
      await addCredits(clientId, pkg.credits, `Package: ${pkg.title}`);
      creditsGranted = pkg.credits;
    }
  } else if (data.credits && data.credits > 0) {
    await addCredits(clientId, data.credits, "Admin grant (conversion)");
    creditsGranted = data.credits;
  }

  // 4. Send welcome email
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.co.za";
    const { subject, html } = await renderEmail("client_welcome", {
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      portalUrl: `${baseUrl}/portal`,
      creditsInfo: creditsGranted > 0
        ? `You have <strong>${creditsGranted} session credit${creditsGranted !== 1 ? "s" : ""}</strong> available.`
        : "",
    });
    await sendEmail({ to: client.email, subject, html, templateKey: "client_welcome", studentId: clientId });
  } catch {
    // Email failure shouldn't block conversion
  }

  revalidatePath(`/admin/clients/${clientId}`);
  revalidatePath("/admin/clients");
}

// ────────────────────────────────────────────────────────────
// Get published packages for convert dialog
// ────────────────────────────────────────────────────────────

export async function getPackagesForConvertAction() {
  await requireRole("super_admin");

  return prisma.hybridPackage.findMany({
    where: { isPublished: true },
    select: { id: true, title: true, credits: true, priceCents: true },
    orderBy: { title: "asc" },
  });
}

// ────────────────────────────────────────────────────────────
// CSV Import (migrated from contacts)
// ────────────────────────────────────────────────────────────

type ImportRow = { email: string; firstName?: string; lastName?: string; phone?: string; gender?: string };
type ImportOptions = { consentGiven: boolean; skipDrip: boolean; tags: string[] };

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function processImportRow(
  row: ImportRow,
  options: ImportOptions,
): Promise<"created" | "updated" | "skipped"> {
  const email = row.email?.trim().toLowerCase();
  if (!email || !isValidEmail(email)) return "skipped";

  const existing = await prisma.student.findUnique({ where: { email } });

  await upsertContact({
    email,
    firstName: row.firstName?.trim() || undefined,
    lastName: row.lastName?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    gender: row.gender?.trim().toLowerCase() || undefined,
    source: "import",
    consentGiven: options.consentGiven,
    consentMethod: options.consentGiven ? "legitimate_interest_existing_client" : undefined,
  });

  // Apply tags and set import-source prefs on the student record
  const student = await prisma.student.findUnique({ where: { email } });
  if (student) {
    await applyImportTags(student, options.tags);
    if (options.skipDrip) await skipDripIfNeeded(student.id);
    // Import contacts: no newsletter or drip feed
    if (!existing) {
      await prisma.student.update({
        where: { id: student.id },
        data: { newsletterOptIn: false, marketingOptIn: false },
      });
    }
  }

  return existing ? "updated" : "created";
}

async function applyImportTags(
  student: { id: string; tags: unknown },
  tags: string[],
) {
  if (tags.length === 0) return;
  const existingTags = (student.tags as string[]) || [];
  const mergedTags = [...new Set([...existingTags, ...tags])];
  await prisma.student.update({
    where: { id: student.id },
    data: { tags: mergedTags },
  });
}

async function skipDripIfNeeded(studentId: string) {
  await prisma.dripProgress.upsert({
    where: { studentId },
    create: {
      studentId,
      currentPhase: "newsletter",
      currentStep: 0,
      completedAt: new Date(),
    },
    update: { completedAt: new Date() },
  });
}

export async function importContactsAction(rows: ImportRow[], options: ImportOptions) {
  await requireRole("super_admin", "marketing");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const result = await processImportRow(row, options);
      if (result === "created") created++;
      else if (result === "updated") updated++;
      else skipped++;
    } catch {
      skipped++;
    }
  }

  revalidatePath("/admin/clients");
  return { created, updated, skipped, total: rows.length };
}
