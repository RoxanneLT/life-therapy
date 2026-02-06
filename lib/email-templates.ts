import { getSessionTypeConfig } from "./booking-config";
import { format } from "date-fns";
import type { Booking, Order, OrderItem, Student } from "@/lib/generated/prisma/client";

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

// ============================================================
// E-Commerce Email Templates
// ============================================================

function formatZAR(cents: number): string {
  return `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
}

export function orderConfirmationEmail(
  order: Order & { items: OrderItem[]; student: Student }
): {
  subject: string;
  html: string;
} {
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${item.description}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatZAR(item.totalCents)}</td>
      </tr>`
    )
    .join("");

  const discountRow =
    order.discountCents > 0
      ? `<tr>
          <td colspan="2" style="padding: 4px 0; text-align: right; color: #16a34a;">Discount</td>
          <td style="padding: 4px 0; text-align: right; color: #16a34a;">-${formatZAR(order.discountCents)}</td>
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
          <td style="padding: 4px 0; text-align: right;">${formatZAR(order.subtotalCents)}</td>
        </tr>
        ${discountRow}
        <tr>
          <td colspan="2" style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #333;">Total Paid</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #333;">${formatZAR(order.totalCents)}</td>
        </tr>
      </tfoot>
    </table>

    <div style="text-align: center; margin: 24px 0;">
      <a href="https://life-therapy.co.za/portal" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to My Courses</a>
    </div>

    <p>If you have any questions, feel free to reply to this email.</p>
    <p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>
  `;

  return {
    subject: `Order Confirmed: ${order.orderNumber}`,
    html: baseTemplate("Order Confirmation", body),
  };
}

export function accountCreatedEmail(params: {
  firstName: string;
  loginUrl: string;
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
    html: baseTemplate("Welcome to Life-Therapy!", body),
  };
}

export function accountProvisionedEmail(params: {
  firstName: string;
  tempPassword: string;
  loginUrl: string;
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
    html: baseTemplate("Your Account is Ready", body),
  };
}

export function courseCompletedEmail(params: {
  firstName: string;
  courseTitle: string;
  certificateNumber: string;
  portalUrl: string;
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
    html: baseTemplate("Course Completed!", body),
  };
}

export function giftDeliveredToBuyerEmail(params: {
  buyerName: string;
  recipientName: string;
  itemTitle: string;
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
    html: baseTemplate("Gift Delivered!", body),
  };
}

export function giftReceivedEmail(params: {
  recipientName: string;
  buyerName: string;
  itemTitle: string;
  message?: string | null;
  redeemUrl: string;
}): {
  subject: string;
  html: string;
} {
  const messageBlock = params.message
    ? `<div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 6px 6px 0; padding: 16px; margin: 16px 0; font-style: italic; color: #92400e;">
        &ldquo;${params.message}&rdquo;
        <p style="margin: 8px 0 0; font-style: normal; font-size: 13px; color: #a16207;">&mdash; ${params.buyerName}</p>
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
    html: baseTemplate("You've Received a Gift!", body),
  };
}
