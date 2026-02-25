import { getSessionTypeConfig } from "./booking-config";
import { formatPrice, escapeHtml } from "./utils";
import { format } from "date-fns";
import type { Currency } from "./region";
import type { Booking, Order, OrderItem, Student } from "@/lib/generated/prisma/client";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";

export function baseTemplate(title: string, body: string, baseUrl = DEFAULT_BASE_URL, unsubscribeUrl?: string): string {
  const domain = baseUrl.replace(/^https?:\/\//, "");
  const unsubLine = unsubscribeUrl
    ? `<p style="margin: 8px 0 0;"><a href="${unsubscribeUrl}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from marketing emails</a></p>`
    : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="${baseUrl}/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">
      <h3 style="color: #333; margin: 0 0 16px; font-size: 20px;">${title}</h3>
      ${body}
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="${baseUrl}" style="color: #8BA889; text-decoration: none; font-weight: 600;">${domain}</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za &middot; +27 71 017 0353</p>
      ${unsubLine}
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
  confirmationToken: string,
  baseUrl = DEFAULT_BASE_URL
): {
  subject: string;
  html: string;
} {
  const config = getSessionTypeConfig(booking.sessionType);
  const dateStr = formatBookingDate(booking);
  const timeStr = formatTimeRange(booking);
  const confirmationUrl = `${baseUrl}/book/confirmation?token=${confirmationToken}`;
  const bookingCurrency = (booking.priceCurrency || "ZAR") as Currency;

  const teamsSection = booking.teamsMeetingUrl
    ? `<div style="background: #f0f7f4; border-radius: 6px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #333;">Join your session:</p>
        <a href="${booking.teamsMeetingUrl}" style="color: #8BA889; font-weight: 600; word-break: break-all;">${booking.teamsMeetingUrl}</a>
      </div>`
    : "";

  const priceSection =
    booking.priceZarCents > 0
      ? `<p style="margin: 8px 0;"><strong>Session fee:</strong> ${formatPrice(booking.priceZarCents, bookingCurrency)} (payment details will be sent separately)</p>`
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
    html: baseTemplate("Your Session is Confirmed!", body, baseUrl),
  };
}

export function bookingNotificationEmail(booking: Booking, baseUrl = DEFAULT_BASE_URL): {
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
      <p style="margin: 4px 0;"><strong>Client:</strong> ${escapeHtml(booking.clientName)}</p>
      <p style="margin: 4px 0;"><strong>Email:</strong> ${escapeHtml(booking.clientEmail)}</p>
      ${booking.clientPhone ? `<p style="margin: 4px 0;"><strong>Phone:</strong> ${escapeHtml(booking.clientPhone)}</p>` : ""}
      ${booking.clientNotes ? `<p style="margin: 4px 0;"><strong>Notes:</strong> ${escapeHtml(booking.clientNotes)}</p>` : ""}
    </div>
    ${booking.teamsMeetingUrl ? `<p><strong>Teams link:</strong> <a href="${booking.teamsMeetingUrl}">${booking.teamsMeetingUrl}</a></p>` : ""}
  `;

  return {
    subject: `New Booking: ${config.label} — ${booking.clientName} (${dateStr})`,
    html: baseTemplate("New Booking Received", body, baseUrl),
  };
}

export function bookingReminderEmail(booking: Booking, baseUrl = DEFAULT_BASE_URL): {
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
    html: baseTemplate("Session Reminder", body, baseUrl),
  };
}

export function bookingCancellationEmail(booking: Booking, baseUrl = DEFAULT_BASE_URL): {
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
      <a href="${baseUrl}/book" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Book a New Session</a>
    </div>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Session Cancelled: ${config.label} on ${dateStr}`,
    html: baseTemplate("Session Cancelled", body, baseUrl),
  };
}

// ============================================================
// E-Commerce Email Templates
// ============================================================

export function orderConfirmationEmail(
  order: Order & { items: OrderItem[]; student: Student },
  currency: Currency = "ZAR",
  baseUrl = DEFAULT_BASE_URL
): {
  subject: string;
  html: string;
} {
  const fmt = (cents: number) => formatPrice(cents, currency);

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${fmt(item.totalCents)}</td>
      </tr>`
    )
    .join("");

  const discountRow =
    order.discountCents > 0
      ? `<tr>
          <td colspan="2" style="padding: 4px 0; text-align: right; color: #16a34a;">Discount</td>
          <td style="padding: 4px 0; text-align: right; color: #16a34a;">-${fmt(order.discountCents)}</td>
        </tr>`
      : "";

  const body = `
    <p>Hi ${order.student.firstName},</p>
    <p>Thank you for your purchase! Here are the details of your order:</p>

    <div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin: 4px 0;"><strong>Date:</strong> ${format(new Date(order.createdAt), "d MMMM yyyy")}</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <thead>
        <tr style="border-bottom: 2px solid #e5e7eb;">
          <th style="padding: 8px 0; text-align: left; font-size: 13px; color: #6b7280;">Item</th>
          <th style="padding: 8px 0; text-align: center; font-size: 13px; color: #6b7280;">Qty</th>
          <th style="padding: 8px 0; text-align: right; font-size: 13px; color: #6b7280;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 4px 0; text-align: right;">Subtotal</td>
          <td style="padding: 4px 0; text-align: right;">${fmt(order.subtotalCents)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td colspan="2" style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #333;">Total Paid</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #333;">${fmt(order.totalCents)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${baseUrl}/portal" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to My Courses</a>
    </div>

    <p>If you have any questions, feel free to reply to this email.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Order Confirmed: ${order.orderNumber}`,
    html: baseTemplate("Order Confirmation", body, baseUrl),
  };
}

export function accountCreatedEmail(params: {
  firstName: string;
  loginUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${params.firstName},</p>
    <p>Welcome to Life-Therapy! Your student account has been created successfully.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.loginUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Go to My Portal</a>
    </div>

    <p>From your portal, you can:</p>
    <ul style="color: #555; padding-left: 20px;">
      <li>Access your courses and track progress</li>
      <li>View certificates of completion</li>
      <li>Manage session credits and bookings</li>
      <li>Update your profile settings</li>
    </ul>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: "Welcome to Life-Therapy!",
    html: baseTemplate("Welcome to Life-Therapy!", body, params.baseUrl),
  };
}

export function accountProvisionedEmail(params: {
  firstName: string;
  tempPassword: string;
  loginUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${params.firstName},</p>
    <p>An account has been created for you on Life-Therapy. You can use the credentials below to log in and access your courses.</p>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">${params.tempPassword}</code></p>
    </div>

    <p style="color: #dc2626; font-weight: 600;">You will be asked to change your password on first login.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.loginUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Log In Now</a>
    </div>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: "Your Life-Therapy Account",
    html: baseTemplate("Your Account is Ready", body, params.baseUrl),
  };
}

export function courseCompletedEmail(params: {
  firstName: string;
  courseTitle: string;
  certificateNumber: string;
  portalUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${params.firstName},</p>
    <p>Congratulations! You have successfully completed <strong>${params.courseTitle}</strong>.</p>

    <div style="background: linear-gradient(135deg, #f0f7f4 0%, #e8f0e6 100%); border-radius: 6px; padding: 24px; margin: 16px 0; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Certificate Number</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333; letter-spacing: 1px;">${params.certificateNumber}</p>
    </div>

    <p>You can view and download your certificate from your student portal.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.portalUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View Certificate</a>
    </div>

    <p>Thank you for learning with us. We hope this course has been valuable on your personal development journey.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Congratulations! You completed ${params.courseTitle}`,
    html: baseTemplate("Course Completed!", body, params.baseUrl),
  };
}

export function giftDeliveredToBuyerEmail(params: {
  buyerName: string;
  recipientName: string;
  itemTitle: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${params.buyerName},</p>
    <p>Just a quick note to let you know that your gift has been delivered!</p>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
      <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Gift for ${params.recipientName}</p>
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">${params.itemTitle}</p>
    </div>

    <p>${params.recipientName} has been sent an email with instructions to redeem their gift.</p>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Your gift for ${params.recipientName} has been delivered!`,
    html: baseTemplate("Gift Delivered!", body, params.baseUrl),
  };
}

export function giftReceivedEmail(params: {
  recipientName: string;
  buyerName: string;
  itemTitle: string;
  message?: string | null;
  redeemUrl: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const messageBlock = params.message
    ? `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 16px; margin: 16px 0; font-style: italic; color: #92400e;">
        &ldquo;${escapeHtml(params.message)}&rdquo;
        <p style="margin: 8px 0 0; font-style: normal; font-size: 13px; color: #a16207;">&mdash; ${escapeHtml(params.buyerName)}</p>
      </div>`
    : "";

  const body = `
    <p>Hi ${params.recipientName},</p>
    <p>Great news! <strong>${params.buyerName}</strong> has sent you a gift from Life-Therapy:</p>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">🎁 ${params.itemTitle}</p>
    </div>

    ${messageBlock}

    <p>To access your gift, click the button below. If you don&rsquo;t have an account yet, you&rsquo;ll be able to create one during the redemption process.</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.redeemUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Redeem Your Gift</a>
    </div>

    <p style="font-size: 13px; color: #6b7280;">This gift doesn&rsquo;t expire — you can redeem it anytime.</p>

    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `🎁 ${params.buyerName} sent you a gift from Life-Therapy!`,
    html: baseTemplate("You've Received a Gift!", body, params.baseUrl),
  };
}

export function portalWelcomeEmail(params: {
  firstName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  sessionDate: string;
  sessionTime: string;
  baseUrl?: string;
}): {
  subject: string;
  html: string;
} {
  const body = `
    <p>Hi ${params.firstName},</p>
    <p>Your free consultation is confirmed for <strong>${params.sessionDate}</strong> at <strong>${params.sessionTime}</strong>.</p>
    <p>In the meantime, your personal portal is ready:</p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${params.loginUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Login to Your Portal</a>
    </div>

    <div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
      <p style="margin: 4px 0;"><strong>Email:</strong> ${params.email}</p>
      <p style="margin: 4px 0;"><strong>Temporary password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">${params.tempPassword}</code></p>
    </div>

    <p style="color: #dc2626; font-weight: 600;">You&rsquo;ll be asked to set your own password on first login.</p>

    <p>In your portal you can:</p>
    <ul style="color: #555; padding-left: 20px;">
      <li>View your scheduled sessions</li>
      <li>Update your personal details</li>
    </ul>

    <p>Looking forward to meeting you!</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Accredited Coach &amp; Counsellor</p>
  `;

  return {
    subject: "Your Life Therapy Portal is Ready",
    html: baseTemplate("Your Portal is Ready", body, params.baseUrl),
  };
}
