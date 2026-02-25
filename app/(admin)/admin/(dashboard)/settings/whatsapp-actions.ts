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
