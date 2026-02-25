"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendWhatsAppTemplate, normalizePhoneNumber, logWhatsAppMessage } from "@/lib/whatsapp";

// ────────────────────────────────────────────────────────────
// Update WhatsApp settings
// ────────────────────────────────────────────────────────────

export async function updateWhatsAppSettingsAction(formData: FormData) {
  await requireRole("super_admin");

  const raw = Object.fromEntries(formData.entries());

  await prisma.siteSetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      whatsappEnabled: raw.whatsappEnabled === "true",
      whatsappPhoneNumberId: (raw.whatsappPhoneNumberId as string) || null,
      whatsappBusinessAccountId: (raw.whatsappBusinessAccountId as string) || null,
      whatsappSessionReminders: raw.whatsappSessionReminders === "true",
      whatsappBillingReminders: raw.whatsappBillingReminders === "true",
      whatsappCreditReminders: raw.whatsappCreditReminders === "true",
      creditExpiryDays: raw.creditExpiryDays ? Number(raw.creditExpiryDays) : null,
    },
    update: {
      whatsappEnabled: raw.whatsappEnabled === "true",
      whatsappPhoneNumberId: (raw.whatsappPhoneNumberId as string) || null,
      whatsappBusinessAccountId: (raw.whatsappBusinessAccountId as string) || null,
      whatsappSessionReminders: raw.whatsappSessionReminders === "true",
      whatsappBillingReminders: raw.whatsappBillingReminders === "true",
      whatsappCreditReminders: raw.whatsappCreditReminders === "true",
      creditExpiryDays: raw.creditExpiryDays ? Number(raw.creditExpiryDays) : null,
    },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Send test WhatsApp message
// ────────────────────────────────────────────────────────────

export async function sendTestWhatsAppAction(phone: string) {
  await requireRole("super_admin");

  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: "hello_world",
  });

  await logWhatsAppMessage({
    templateName: "hello_world",
    to: normalizePhoneNumber(phone),
    status: result.success ? "sent" : "failed",
    waMessageId: result.messageId,
    error: result.error,
    metadata: { type: "test" },
  });

  revalidatePath("/admin/settings");
  return result;
}

// ────────────────────────────────────────────────────────────
// Get WhatsApp message logs (paginated)
// ────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────
// WhatsApp template management
// ────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  { name: "session_reminder_48h", bodyText: "Hi {{1}}, this is a reminder that your {{2}} session is on {{3}} at {{4}}.", description: "Sent 48 hours before a session", sortOrder: 1 },
  { name: "session_reminder_today", bodyText: "Hi {{1}}, your session is today at {{2}}. Join here: {{3}}", description: "Sent morning of session", sortOrder: 2 },
  { name: "billing_request", bodyText: "Hi {{1}}, your {{2}} invoice of {{3}} is due by {{4}}. Pay here: {{5}}", description: "Sent when payment request is created", sortOrder: 3 },
  { name: "billing_reminder", bodyText: "Hi {{1}}, a friendly reminder that {{2}} is due by {{3}}. Pay here: {{4}}", description: "Sent 2 days before due date", sortOrder: 4 },
  { name: "billing_overdue", bodyText: "Hi {{1}}, your payment of {{2}} for {{3}} is overdue. Please pay here: {{4}}", description: "Sent 1 day after due date", sortOrder: 5 },
  { name: "credit_expiry_14d", bodyText: "Hi {{1}}, you have {{2}} session credit(s) expiring on {{3}}. Book now to use them!", description: "Sent 14 days before credits expire", sortOrder: 6 },
  { name: "credit_expiry_3d", bodyText: "Hi {{1}}, your {{2}} session credit(s) expire on {{3}} — only 3 days left!", description: "Sent 3 days before credits expire", sortOrder: 7 },
];

export async function getWhatsAppTemplatesAction() {
  await requireRole("super_admin", "editor");

  const templates = await prisma.whatsAppTemplate.findMany({
    orderBy: { sortOrder: "asc" },
  });

  // Seed defaults if empty
  if (templates.length === 0) {
    await prisma.whatsAppTemplate.createMany({ data: DEFAULT_TEMPLATES });
    return prisma.whatsAppTemplate.findMany({ orderBy: { sortOrder: "asc" } });
  }

  return templates;
}

export async function updateWhatsAppTemplateAction(
  id: string,
  data: { bodyText: string; description?: string },
) {
  await requireRole("super_admin");

  await prisma.whatsAppTemplate.update({
    where: { id },
    data: {
      bodyText: data.bodyText,
      description: data.description ?? undefined,
    },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Get WhatsApp message logs (paginated)
// ────────────────────────────────────────────────────────────

export async function getWhatsAppLogsAction(page: number, limit: number = 10) {
  await requireRole("super_admin", "editor");

  const [logs, total] = await Promise.all([
    prisma.whatsAppLog.findMany({
      orderBy: { sentAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        student: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.whatsAppLog.count(),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      templateName: log.templateName,
      to: log.to,
      studentName: log.student
        ? `${log.student.firstName} ${log.student.lastName}`
        : null,
      status: log.status,
      error: log.error,
      sentAt: log.sentAt.toISOString(),
    })),
    total,
    pages: Math.ceil(total / limit),
  };
}
