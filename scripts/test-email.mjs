/**
 * Quick SMTP email test — reads settings from DB, sends a test email.
 * Usage: node scripts/test-email.mjs
 */
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(".", ".env.local") });

import pg from "pg";
import nodemailer from "nodemailer";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query("SELECT * FROM site_settings LIMIT 1");
  await pool.end();

  if (!rows.length) {
    console.error("No site_settings row found in DB.");
    process.exit(1);
  }

  const s = rows[0];
  console.log("DB columns:", Object.keys(s).join(", "));
  console.log();

  // Prisma stores camelCase column names as-is in PostgreSQL
  const smtpHost = s.smtpHost;
  const smtpPort = s.smtpPort;
  const smtpUser = s.smtpUser;
  const smtpPass = s.smtpPass;
  const smtpFromName = s.smtpFromName || "Life-Therapy";
  const smtpFromEmail = s.smtpFromEmail || smtpUser;

  console.log("SMTP Config:");
  console.log("  Host:", smtpHost);
  console.log("  Port:", smtpPort);
  console.log("  User:", smtpUser);
  console.log("  Pass:", smtpPass ? "***" + smtpPass.slice(-4) : "(empty)");
  console.log("  From:", `"${smtpFromName}" <${smtpFromEmail}>`);
  console.log();

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
    console.error("SMTP settings incomplete — cannot send test email.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(smtpPort),
    secure: Number(smtpPort) === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  console.log("Verifying SMTP connection...");
  try {
    await transporter.verify();
    console.log("SMTP connection OK!\n");
  } catch (err) {
    console.error("SMTP verification failed:", err.message);
    process.exit(1);
  }

  console.log("Sending test email to:", smtpUser);
  try {
    const info = await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: smtpUser,
      subject: "Life-Therapy SMTP Test",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <div style="background: #8BA889; padding: 16px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Life-Therapy</h1>
          </div>
          <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>This is a test email from your Life-Therapy booking system.</p>
            <p>If you're reading this, your SMTP settings are configured correctly!</p>
            <p style="color: #6b7280; font-size: 14px;">Sent at: ${new Date().toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" })} SAST</p>
          </div>
        </div>
      `,
    });
    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
  } catch (err) {
    console.error("Failed to send email:", err.message);
    process.exit(1);
  }
}

main();
