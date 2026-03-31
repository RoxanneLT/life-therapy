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

  // Find existing settings row (never hardcode "default" — use the real row)
  const existing = await prisma.siteSetting.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!existing) {
    return { success: false, error: "No site settings found" };
  }

  await prisma.siteSetting.update({
    where: { id: existing.id },
    data: {
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
    templateName: "session_reminder_today",
    languageCode: "en",
    components: [{
      type: "body",
      parameters: [
        { type: "text", text: "Test" },
        { type: "text", text: "10:00" },
        { type: "text", text: "https://life-therapy.co.za" },
      ],
    }],
  });

  await logWhatsAppMessage({
    templateName: "session_reminder_today",
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

const DO_NOT_REPLY = "\n\nThis is an automated message. Please do not reply.";

const DEFAULT_TEMPLATES = [
  { name: "session_reminder_24h", bodyText: `Hi {{1}}, this is a friendly reminder that you have a {{2}} session scheduled for {{3}} at {{4}}. We look forward to seeing you! — Life Therapy${DO_NOT_REPLY}`, description: "Sent 24 hours before a session", sortOrder: 1 },
  { name: "session_reminder_today", bodyText: `Hi {{1}}, just a reminder that your session is coming up today at {{2}}. See you soon! — Life Therapy${DO_NOT_REPLY}`, description: "Sent morning of session", sortOrder: 2 },
  { name: "billing_request", bodyText: `Hi {{1}}, your invoice for {{2}} is ready. Amount due: {{3}}, payable by {{4}}. Pay here: {{5}} — Life Therapy${DO_NOT_REPLY}`, description: "Sent when payment request is created", sortOrder: 3 },
  { name: "billing_reminder", bodyText: `Hi {{1}}, a friendly reminder that {{2}} is due by {{3}}. Pay here: {{4}} — Life Therapy${DO_NOT_REPLY}`, description: "Sent 2 days before due date", sortOrder: 4 },
  { name: "billing_due_today", bodyText: `Hi {{1}}, your payment of {{2}} is due today. Pay here: {{3}} — Life Therapy${DO_NOT_REPLY}`, description: "Sent on the due date", sortOrder: 5 },
  { name: "billing_overdue", bodyText: `Hi {{1}}, your payment of {{2}} for {{3}} is now overdue. Please settle as soon as possible: {{4}} — Life Therapy${DO_NOT_REPLY}`, description: "Sent 1 day after due date", sortOrder: 6 },
  { name: "credits_expiry_14d", bodyText: `Hi {{1}}, this is a notice that your {{2}} session credits are set to expire on {{3}}. Please contact us if you have any questions. — Life Therapy${DO_NOT_REPLY}`, description: "Sent 14 days before credits expire", sortOrder: 7 },
  { name: "credits_expiry_3d", bodyText: `Hi {{1}}, this is a notice that your {{2}} session credits will expire on {{3}}. Please contact us if you need assistance. — Life Therapy${DO_NOT_REPLY}`, description: "Sent 3 days before credits expire", sortOrder: 8 },
];

export async function getWhatsAppTemplatesAction() {
  await requireRole("super_admin", "editor");

  const templates = await prisma.whatsAppTemplate.findMany({
    orderBy: { sortOrder: "asc" },
  });

  // Ensure all default templates exist (upsert by name)
  const existingNames = new Set(templates.map((t) => t.name));
  const missing = DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name));
  if (missing.length > 0) {
    await prisma.whatsAppTemplate.createMany({ data: missing });
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
