import { getSiteSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";

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

/**
 * Inject a 1x1 tracking pixel and wrap links for click tracking.
 */
function injectTracking(html: string, trackingId: string, baseUrl: string): string {
  let tracked = html.replaceAll(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url: string) => {
      if (url.includes("/api/unsubscribe") || url.includes("/api/track/")) {
        return `href="${url}"`;
      }
      const encoded = encodeURIComponent(url);
      return `href="${baseUrl}/api/track/click?t=${trackingId}&url=${encoded}"`;
    }
  );

  const pixel = `<img src="${baseUrl}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;border:0;" alt="" />`;
  if (tracked.includes("</body>")) {
    tracked = tracked.replace("</body>", `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  return tracked;
}

/** Send via Resend API */
async function sendViaResend(
  opts: { from: string; to: string; subject: string; html: string; replyTo?: string; attachments?: EmailAttachment[] },
) {
  const resend = new Resend(process.env.RESEND_API_KEY);
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

  const useResend = !!process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number.parseInt(process.env.SMTP_PORT, 10) : null;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const hasSMTP = !!(smtpHost && smtpPort && smtpUser && smtpPass);

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
        const from = process.env.RESEND_FROM || `${settings.smtpFromName || "Life-Therapy"} <hello@life-therapy.co.za>`;
        await sendViaResend({ from, to, subject, html: finalHtml, replyTo, attachments });
      } else {
        const from = `"${settings.smtpFromName || "Life-Therapy"}" <${settings.smtpFromEmail || smtpUser}>`;
        await sendViaSMTP(
          { from, to, subject, html: finalHtml, replyTo, attachments },
          { host: smtpHost!, port: smtpPort!, user: smtpUser!, pass: smtpPass! },
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
