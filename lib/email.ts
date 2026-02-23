import { getSiteSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { randomUUID } from "node:crypto";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  templateKey?: string;
  studentId?: string;
  metadata?: Record<string, unknown>;
  skipTracking?: boolean; // Skip tracking injection (e.g. for admin test emails)
}

/**
 * Inject a 1x1 tracking pixel and wrap links for click tracking.
 */
function injectTracking(html: string, trackingId: string, baseUrl: string): string {
  // Wrap links with click tracking redirect (skip unsubscribe and track links)
  let tracked = html.replaceAll(
    /href="(https?:\/\/[^"]+)"/gi,
    (_match, url: string) => {
      // Don't wrap unsubscribe links or existing tracking links
      if (url.includes("/api/unsubscribe") || url.includes("/api/track/")) {
        return `href="${url}"`;
      }
      const encoded = encodeURIComponent(url);
      return `href="${baseUrl}/api/track/click?t=${trackingId}&url=${encoded}"`;
    }
  );

  // Inject tracking pixel before </body> or at the end
  const pixel = `<img src="${baseUrl}/api/track/open?t=${trackingId}" width="1" height="1" style="display:none;border:0;" alt="" />`;
  if (tracked.includes("</body>")) {
    tracked = tracked.replace("</body>", `${pixel}</body>`);
  } else {
    tracked += pixel;
  }

  return tracked;
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
  templateKey,
  studentId,
  metadata,
  skipTracking,
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const settings = await getSiteSettings();

  // Generate tracking ID and inject tracking into HTML
  const trackingId = skipTracking ? undefined : randomUUID();
  const finalHtml = trackingId ? injectTracking(html, trackingId, DEFAULT_BASE_URL) : html;

  const useResend = !!process.env.RESEND_API_KEY;
  const hasSMTP = !!(settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass);

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
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM || `${settings.smtpFromName || "Life-Therapy"} <hello@life-therapy.co.za>`;
        const { error } = await resend.emails.send({
          from,
          to,
          subject,
          html: finalHtml,
          ...(replyTo ? { replyTo } : {}),
        });
        if (error) throw new Error(error.message);
      } else {
        const transporter = nodemailer.createTransport({
          host: settings.smtpHost,
          port: settings.smtpPort!,
          secure: settings.smtpPort === 465,
          auth: { user: settings.smtpUser!, pass: settings.smtpPass! },
        } as nodemailer.TransportOptions);
        await transporter.sendMail({
          from: `"${settings.smtpFromName || "Life-Therapy"}" <${settings.smtpFromEmail || settings.smtpUser}>`,
          to,
          subject,
          html: finalHtml,
          ...(replyTo ? { replyTo } : {}),
        });
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
