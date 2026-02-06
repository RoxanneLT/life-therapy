import { getSiteSettings } from "@/lib/settings";
import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const settings = await getSiteSettings();

  if (
    !settings.smtpHost ||
    !settings.smtpPort ||
    !settings.smtpUser ||
    !settings.smtpPass
  ) {
    console.error("SMTP not configured — email not sent:", subject);
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

  try {
    await transporter.sendMail({
      from: `"${settings.smtpFromName || "Life-Therapy"}" <${settings.smtpFromEmail || settings.smtpUser}>`,
      to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { success: false, error: String(error) };
  }
}
