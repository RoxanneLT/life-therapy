/**
 * Default email template content for reset functionality.
 * These match the seed data from scripts/migrate-email-templates.sql.
 */

interface TemplateDefault {
  subject: string;
  bodyHtml: string;
}

const defaults: Record<string, TemplateDefault> = {
  booking_confirmation: {
    subject: "Booking Confirmed: {{sessionType}} on {{date}}",
    bodyHtml: `<p>Hi {{clientName}},</p>
<p>Your session has been confirmed! Here are the details:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{date}}</p>
  <p style="margin: 4px 0;"><strong>Time:</strong> {{time}}</p>
  <p style="margin: 4px 0;"><strong>Duration:</strong> {{duration}} minutes</p>
  {{priceSection}}
</div>
{{teamsSection}}
<div style="text-align: center; margin: 24px 0;">
  <a href="{{confirmationUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Booking Details</a>
</div>
<h4 style="margin: 24px 0 8px;">What to expect:</h4>
<ul style="color: #555; padding-left: 20px;">
  <li>Find a quiet, comfortable space for your session</li>
  <li>Test your internet connection and audio/video beforehand</li>
  <li>Join the meeting link a few minutes early</li>
  <li>Have a glass of water handy</li>
</ul>
<p>If you need to reschedule or cancel, please contact us at least 24 hours in advance.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  booking_notification: {
    subject: "New Booking: {{sessionType}} — {{clientName}} ({{date}})",
    bodyHtml: `<p>A new booking has been received:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{date}}</p>
  <p style="margin: 4px 0;"><strong>Time:</strong> {{time}}</p>
  <p style="margin: 4px 0;"><strong>Duration:</strong> {{duration}} min</p>
</div>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  {{clientDetails}}
</div>
{{teamsLink}}`,
  },
  booking_reminder: {
    subject: "Reminder: Your session is tomorrow at {{startTime}}",
    bodyHtml: `<p>Hi {{clientName}},</p>
<p>This is a friendly reminder that your session is <strong>tomorrow</strong>.</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{date}}</p>
  <p style="margin: 4px 0;"><strong>Time:</strong> {{time}}</p>
</div>
{{teamsButton}}
<p>Looking forward to our session!</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  booking_cancellation: {
    subject: "Session Cancelled: {{sessionType}} on {{date}}",
    bodyHtml: `<p>Hi {{clientName}},</p>
<p>Your session has been cancelled. Here were the details:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{date}}</p>
  <p style="margin: 4px 0;"><strong>Time:</strong> {{time}}</p>
</div>
<p>If you&rsquo;d like to rebook, you can schedule a new session below.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{bookUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Book a New Session</a>
</div>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  order_confirmation: {
    subject: "Order Confirmed: {{orderNumber}}",
    bodyHtml: `<p>Hi {{firstName}},</p>
<p>Thank you for your purchase! Here are the details of your order:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Order Number:</strong> {{orderNumber}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{orderDate}}</p>
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
    {{orderItemsTable}}
  </tbody>
  <tfoot>
    <tr>
      <td colspan="2" style="padding: 4px 0; text-align: right;">Subtotal</td>
      <td style="padding: 4px 0; text-align: right;">{{subtotal}}</td>
    </tr>
    {{discountRow}}
    <tr>
      <td colspan="2" style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #333;">Total Paid</td>
      <td style="padding: 8px 0; text-align: right; font-weight: 700; font-size: 16px; border-top: 2px solid #333;">{{total}}</td>
    </tr>
  </tfoot>
</table>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{portalUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Go to My Courses</a>
</div>
<p>If you have any questions, feel free to reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  account_created: {
    subject: "Welcome to Life-Therapy!",
    bodyHtml: `<p>Hi {{firstName}},</p>
<p>Welcome to Life-Therapy! Your student account has been created successfully.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{loginUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Go to My Portal</a>
</div>
<p>From your portal, you can:</p>
<ul style="color: #555; padding-left: 20px;">
  <li>Access your courses and track progress</li>
  <li>View certificates of completion</li>
  <li>Manage session credits and bookings</li>
  <li>Update your profile settings</li>
</ul>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  account_provisioned: {
    subject: "Your Life-Therapy Account",
    bodyHtml: `<p>Hi {{firstName}},</p>
<p>An account has been created for you on Life-Therapy. You can use the credentials below to log in and access your courses.</p>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">{{tempPassword}}</code></p>
</div>
<p style="color: #dc2626; font-weight: 600;">You will be asked to change your password on first login.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{loginUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Log In Now</a>
</div>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  course_completed: {
    subject: "Congratulations! You completed {{courseTitle}}",
    bodyHtml: `<p>Hi {{firstName}},</p>
<p>Congratulations! You have successfully completed <strong>{{courseTitle}}</strong>.</p>
<div style="background: linear-gradient(135deg, #f0f7f4 0%, #e8f0e6 100%); border-radius: 6px; padding: 24px; margin: 16px 0; text-align: center;">
  <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Certificate Number</p>
  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333; letter-spacing: 1px;">{{certificateNumber}}</p>
</div>
<p>You can view and download your certificate from your student portal.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{portalUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View Certificate</a>
</div>
<p>Thank you for learning with us. We hope this course has been valuable on your personal development journey.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  gift_received: {
    subject: "\u{1F381} {{buyerName}} sent you a gift from Life-Therapy!",
    bodyHtml: `<p>Hi {{recipientName}},</p>
<p>Great news! <strong>{{buyerName}}</strong> has sent you a gift from Life-Therapy:</p>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">\u{1F381} {{itemTitle}}</p>
</div>
{{messageBlock}}
<p>To access your gift, click the button below. If you don&rsquo;t have an account yet, you&rsquo;ll be able to create one during the redemption process.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{redeemUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Redeem Your Gift</a>
</div>
<p style="font-size: 13px; color: #6b7280;">This gift doesn&rsquo;t expire &mdash; you can redeem it anytime.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  gift_delivered_buyer: {
    subject: "Your gift for {{recipientName}} has been delivered!",
    bodyHtml: `<p>Hi {{buyerName}},</p>
<p>Just a quick note to let you know that your gift has been delivered!</p>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
  <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Gift for {{recipientName}}</p>
  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">{{itemTitle}}</p>
</div>
<p>{{recipientName}} has been sent an email with instructions to redeem their gift.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
};

export default defaults;
