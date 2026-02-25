/**
 * WhatsApp Cloud API integration.
 *
 * Sends template messages via Meta's Cloud API.
 * All messages are utility templates (session/billing/credit reminders).
 *
 * Env: WHATSAPP_ACCESS_TOKEN (permanent token from Meta Business Suite)
 * DB:  SiteSetting.whatsappPhoneNumberId (Meta phone number ID)
 */

import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";

const WHATSAPP_API_URL = "https://graph.facebook.com/v21.0";

// ─── Types ───────────────────────────────────────────────────

export interface TemplateComponent {
  type: "body" | "header" | "button";
  parameters: Array<{
    type: "text" | "date_time" | "currency";
    text?: string;
  }>;
}

interface SendTemplateParams {
  to: string; // E.164 format: +27821234567
  templateName: string;
  languageCode?: string; // default: "en"
  components?: TemplateComponent[];
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ─── Phone number helpers ────────────────────────────────────

/**
 * Normalize SA phone numbers to E.164 format.
 * "082 123 4567" → "+27821234567"
 * "0821234567"   → "+27821234567"
 * "+27821234567" → "+27821234567"
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return `+27${digits.slice(1)}`;
  if (digits.startsWith("27")) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Validate that a phone number is a valid SA mobile number.
 */
export function isValidSAPhone(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^\+27\d{9}$/.test(normalized);
}

// ─── Core send function ──────────────────────────────────────

/**
 * Send a WhatsApp template message via the Cloud API.
 */
export async function sendWhatsAppTemplate(
  params: SendTemplateParams,
): Promise<SendResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const settings = await getSiteSettings();
  const phoneNumberId = settings.whatsappPhoneNumberId;

  if (!token || !phoneNumberId) {
    return { success: false, error: "WhatsApp not configured" };
  }

  const body = {
    messaging_product: "whatsapp",
    to: normalizePhoneNumber(params.to),
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.languageCode || "en" },
      components: params.components || [],
    },
  };

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: data.error?.message || `HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Logging ─────────────────────────────────────────────────

/**
 * Log a WhatsApp message to the database.
 */
export async function logWhatsAppMessage(params: {
  templateName: string;
  to: string;
  studentId?: string;
  waMessageId?: string;
  status: string;
  error?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.whatsAppLog.create({
    data: {
      templateName: params.templateName,
      to: params.to,
      studentId: params.studentId,
      waMessageId: params.waMessageId,
      status: params.status,
      error: params.error,
      metadata: params.metadata as Parameters<typeof prisma.whatsAppLog.create>[0]["data"]["metadata"],
    },
  });
}

// ─── High-level send + log ───────────────────────────────────

/**
 * Send a template message and log the result.
 * Checks smsOptIn on the student — only sends if opted in.
 */
export async function sendAndLogTemplate(params: {
  studentId: string;
  phone: string;
  templateName: string;
  components?: TemplateComponent[];
  metadata?: Record<string, unknown>;
}): Promise<SendResult> {
  const student = await prisma.student.findUnique({
    where: { id: params.studentId },
    select: { smsOptIn: true, phone: true },
  });

  if (!student?.smsOptIn) {
    return { success: false, error: "Client not opted in for WhatsApp" };
  }

  const phone = params.phone || student.phone;
  if (!phone) {
    return { success: false, error: "No phone number" };
  }

  if (!isValidSAPhone(phone)) {
    const error = `Invalid SA phone number: ${phone}`;
    await logWhatsAppMessage({
      templateName: params.templateName,
      to: phone,
      studentId: params.studentId,
      status: "failed",
      error,
      metadata: params.metadata,
    });
    return { success: false, error };
  }

  const result = await sendWhatsAppTemplate({
    to: phone,
    templateName: params.templateName,
    components: params.components,
  });

  await logWhatsAppMessage({
    templateName: params.templateName,
    to: normalizePhoneNumber(phone),
    studentId: params.studentId,
    waMessageId: result.messageId,
    status: result.success ? "sent" : "failed",
    error: result.error,
    metadata: params.metadata,
  });

  return result;
}
