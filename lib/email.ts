import { getSiteSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";
import { appBaseUrl } from "@/lib/region";
import { injectTracking } from "@/lib/email-tracking";
import { requireEnv, isConfigured, envOr } from "@/lib/env";

const DEFAULT_BASE_URL = appBaseUrl();

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  templateKey?: string;
  studentId?: string;
  metadata?: Record<string, unknown>;
  skipTracking?: boolean;
  attachments?: EmailAttachment[];
}


/** Send via Resend API */
async function sendViaResend(
  opts: { from: string; to: string; subject: string; html: string; replyTo?: string; attachments?: EmailAttachment[] },
) {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const { error } = await resend.emails.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.attachments?.length
      ? {
          attachments: opts.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            content_type: a.contentType,
          })),
        }
      : {}),
  });
  if (error) throw new Error(error.message);
}

/** Send via SMTP / Nodemailer */
async function sendViaSMTP(
  opts: { from: string; to: string; subject: string; html: string; replyTo?: string; attachments?: EmailAttachment[] },
  smtp: { host: string; port: number; user: string; pass: string },
) {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  } as nodemailer.TransportOptions);
  await transporter.sendMail({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    ...(opts.attachments?.length
      ? {
          attachments: opts.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType || "application/octet-stream",
          })),
        }
      : {}),
  });
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, replyTo, templateKey, studentId, metadata, skipTracking, attachments } = options;
  const settings = await getSiteSettings();

  const trackingId = skipTracking ? undefined : randomUUID();
  const finalHtml = trackingId ? injectTracking(html, trackingId, DEFAULT_BASE_URL) : html;

  const useResend = isConfigured("RESEND_API_KEY");
  const hasSMTP = isConfigured("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS");

  if (!useResend && !hasSMTP) {
    console.error("No email provider configured — email not sent:", subject);
    await logEmail({ to, subject, templateKey, studentId, metadata, status: "failed", error: "No email provider configured" });
    return { success: false, error: "No email provider configured" };
  }

  const MAX_RETRIES = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (useResend) {
        const from = envOr("RESEND_FROM", `${settings.smtpFromName || "Life-Therapy"} <hello@life-therapy.co.za>`);
        await sendViaResend({ from, to, subject, html: finalHtml, replyTo, attachments });
      } else {
        // hasSMTP guaranteed all four present above; requireEnv makes that explicit.
        const host = requireEnv("SMTP_HOST");
        const port = Number.parseInt(requireEnv("SMTP_PORT"), 10);
        const user = requireEnv("SMTP_USER");
        const pass = requireEnv("SMTP_PASS");
        const from = `"${settings.smtpFromName || "Life-Therapy"}" <${settings.smtpFromEmail || user}>`;
        await sendViaSMTP(
          { from, to, subject, html: finalHtml, replyTo, attachments },
          { host, port, user, pass },
        );
      }
      await logEmail({ to, subject, templateKey, studentId, metadata, status: "sent", trackingId });
      return { success: true };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  console.error("Failed to send email after retries:", lastError);
  await logEmail({ to, subject, templateKey, studentId, metadata, status: "failed", error: String(lastError), trackingId });
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
  trackingId?: string;
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
        trackingId: params.trackingId || null,
      },
    });
  } catch (err) {
    console.error("Failed to log email:", err);
  }
}
