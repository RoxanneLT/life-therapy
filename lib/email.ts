import { getSiteSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  templateKey?: string;
  studentId?: string;
  metadata?: Record<string, unknown>;
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  templateKey,
  studentId,
  metadata,
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const settings = await getSiteSettings();

  if (
    !settings.smtpHost ||
    !settings.smtpPort ||
    !settings.smtpUser ||
    !settings.smtpPass
  ) {
    console.error("SMTP not configured — email not sent:", subject);
    await logEmail({ to, subject, templateKey, studentId, metadata, status: "failed", error: "SMTP not configured" });
    return { success: false, error: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
  });

  const MAX_RETRIES = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await transporter.sendMail({
        from: `"${settings.smtpFromName || "Life-Therapy"}" <${settings.smtpFromEmail || settings.smtpUser}>`,
        to,
        subject,
        html,
        ...(replyTo ? { replyTo } : {}),
      });
      await logEmail({ to, subject, templateKey, studentId, metadata, status: "sent" });
      return { success: true };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  console.error("Failed to send email after retries:", lastError);
  await logEmail({ to, subject, templateKey, studentId, metadata, status: "failed", error: String(lastError) });
  return { success: false, error: String(lastError) };
}

async function logEmail(params: {
  to: string;
  subject: string;
  templateKey?: string;
  studentId?: string;
  metadata?: Record<string, unknown>;
  status: string;
  error?: string;
}) {
  try {
    await prisma.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject,
        templateKey: params.templateKey || null,
        studentId: params.studentId || null,
        metadata: params.metadata as Prisma.InputJsonValue ?? undefined,
        status: params.status,
        error: params.error || null,
      },
    });
  } catch (err) {
    console.error("Failed to log email:", err);
  }
}
