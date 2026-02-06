import { getSessionTypeConfig } from "./booking-config";
import { format } from "date-fns";
import type { Booking } from "@/lib/generated/prisma/client";

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="https://life-therapy.co.za/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      <h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">${title}</h3>
      ${body}
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.co.za" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.co.za</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za &middot; +27 71 017 0353</p>
    </div>
  </div>
</body></html>`;
}

function formatBookingDate(booking: Booking): string {
  return format(new Date(booking.date), "EEEE, d MMMM yyyy");
}

function formatTimeRange(booking: Booking): string {
  return `${booking.startTime} – ${booking.endTime} (SAST)`;
}

export function bookingConfirmationEmail(
  booking: Booking,
  confirmationToken: string
): {
  subject: string;
  html: string;
} {
  const config = getSessionTypeConfig(booking.sessionType);
  const dateStr = formatBookingDate(booking);
  const timeStr = formatTimeRange(booking);
  const confirmationUrl = `https://life-therapy.co.za/book/confirmation?token=${confirmationToken}`;

  const teamsSection = booking.teamsMeetingUrl
    ? `<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p>
        <a href="${booking.teamsMeetingUrl}" style="color: #8BA889; font-weight: 600; word-break: break-all;">${booking.teamsMeetingUrl}</a>
      </div>`
    : "";

  const priceSection =
    booking.priceZarCents > 0
      ? `<p style="margin: 8px 0;"><strong>Session fee:</strong> R${(booking.priceZarCents / 100).toLocaleString()} (payment details will be sent separately)</p>`
      : "";

  const body = `
    <p>Hi ${booking.clientName},</p>
    <p>Your session has been confirmed! Here are the details:</p>
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Session:</strong> ${config.label}</p>
      <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}</p>
      <p style="margin: 4px 0;"><strong>Duration:</strong> ${config.durationMinutes} minutes</p>
      ${priceSection}
    </div>
    ${teamsSection}
    <div style="text-align: center; margin: 24px 0;">
      <a href="${confirmationUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking Details</a>
    </div>
    <h4 style="margin: 24px 0 8px;">What to expect:</h4>
    <ul style="color: #555; padding-left: 20px;">
      <li>Find a quiet, comfortable space for your session</li>
      <li>Test your internet connection and audio/video beforehand</li>
      <li>Join the meeting link a few minutes early</li>
      <li>Have a glass of water handy</li>
    </ul>
    <p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Booking Confirmed: ${config.label} on ${dateStr}`,
    html: baseTemplate("Your Session is Confirmed!", body),
  };
}

export function bookingNotificationEmail(booking: Booking): {
  subject: string;
  html: string;
} {
  const config = getSessionTypeConfig(booking.sessionType);
  const dateStr = formatBookingDate(booking);
  const timeStr = formatTimeRange(booking);

  const body = `
    <p>A new booking has been received:</p>
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Session:</strong> ${config.label}</p>
      <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}</p>
      <p style="margin: 4px 0;"><strong>Duration:</strong> ${config.durationMinutes} min</p>
    </div>
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Client:</strong> ${booking.clientName}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${booking.clientEmail}</p>
      ${booking.clientPhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${booking.clientPhone}</p>` : ""}
      ${booking.clientNotes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${booking.clientNotes}</p>` : ""}
    </div>
    ${booking.teamsMeetingUrl ? `<p><strong>Teams link:</strong> <a href="${booking.teamsMeetingUrl}">${booking.teamsMeetingUrl}</a></p>` : ""}
  `;

  return {
    subject: `New Booking: ${config.label} — ${booking.clientName} (${dateStr})`,
    html: baseTemplate("New Booking Received", body),
  };
}

export function bookingReminderEmail(booking: Booking): {
  subject: string;
  html: string;
} {
  const config = getSessionTypeConfig(booking.sessionType);
  const dateStr = formatBookingDate(booking);
  const timeStr = formatTimeRange(booking);

  const teamsButton = booking.teamsMeetingUrl
    ? `<div style="text-align: center; margin: 24px 0;">
        <a href="${booking.teamsMeetingUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Join Microsoft Teams Meeting</a>
      </div>`
    : "";

  const body = `
    <p>Hi ${booking.clientName},</p>
    <p>This is a friendly reminder that your session is <strong>tomorrow</strong>.</p>
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Session:</strong> ${config.label}</p>
      <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}</p>
    </div>
    ${teamsButton}
    <p>Looking forward to our session!</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Reminder: Your session is tomorrow at ${booking.startTime}`,
    html: baseTemplate("Session Reminder", body),
  };
}

export function bookingCancellationEmail(booking: Booking): {
  subject: string;
  html: string;
} {
  const config = getSessionTypeConfig(booking.sessionType);
  const dateStr = formatBookingDate(booking);
  const timeStr = formatTimeRange(booking);

  const body = `
    <p>Hi ${booking.clientName},</p>
    <p>Your session has been cancelled. Here were the details:</p>
    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Session:</strong> ${config.label}</p>
      <p style="margin: 4px 0;"><strong>Date:</strong> ${dateStr}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${timeStr}</p>
    </div>
    <p>If you&rsquo;d like to rebook, you can schedule a new session below.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="https://life-therapy.co.za/book" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Book a New Session</a>
    </div>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Session Cancelled: ${config.label} on ${dateStr}`,
    html: baseTemplate("Session Cancelled", body),
  };
}
