/**
 * Default email template content for reset functionality.
 * These match the seed data from scripts/migrate-email-templates.sql.
 */

interface TemplateDefault {
  subject: string;
  bodyHtml: string;
}

const defaults: Record<string, TemplateDefault> = {
  portal_welcome: {
    subject: "Your Life Therapy Portal is Ready",
    bodyHtml: `<p>Hi {{firstName}},</p>
<p>Your free consultation is confirmed for <strong>{{sessionDate}}</strong> at <strong>{{sessionTime}}</strong>.</p>
<p>In the meantime, your personal portal is ready:</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{loginUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Login to Your Portal</a>
</div>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Email:</strong> {{email}}</p>
  <p style="margin: 4px 0;"><strong>Temporary password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">{{tempPassword}}</code></p>
</div>
<p style="color: #dc2626; font-weight: 600;">You&rsquo;ll be asked to set your own password on first login.</p>
<p>In your portal you can:</p>
<ul style="color: #555; padding-left: 20px;">
  <li>View your scheduled sessions</li>
  <li>Update your personal details</li>
</ul>
<p>Looking forward to meeting you!</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Accredited Coach &amp; Counsellor</p>`,
  },
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
  password_reset: {
    subject: "Reset Your Password — Life-Therapy",
    bodyHtml: `<p>Hi there,</p>
<p>We received a request to reset your password. Click the button below to choose a new one:</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{resetUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Reset Password</a>
</div>
<p style="color: #6b7280; font-size: 13px;">This link expires in 1 hour. If you didn&rsquo;t request a password reset, you can safely ignore this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  client_welcome: {
    subject: "Welcome to Life-Therapy — You're All Set!",
    bodyHtml: `<p>Hi {{clientName}},</p>
<p>Welcome! You are now an active client at Life-Therapy. We're looking forward to supporting you on your journey.</p>
{{creditsInfo}}
<p>From your portal you can:</p>
<ul>
  <li>Book and manage your sessions</li>
  <li>View your session credits</li>
  <li>Complete your personal assessment</li>
  <li>Update your profile and preferences</li>
</ul>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{portalUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Go to My Portal</a>
</div>
<p>If you have any questions, feel free to reply to this email.</p>
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
  password_changed: {
    subject: "Your Life-Therapy password has been changed",
    bodyHtml: `<p>Hi {{firstName}},</p>
<p>Your password has been successfully changed.</p>
<p>If you did not make this change, please contact us immediately at <a href="mailto:hello@life-therapy.co.za" style="color: #8BA889;">hello@life-therapy.co.za</a>.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  booking_reschedule: {
    subject: "Session Rescheduled: {{sessionType}} — New Date {{newDate}}",
    bodyHtml: `<p>Hi {{clientName}},</p>
<p>Your session has been rescheduled. Here are the updated details:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0; color: #6b7280; text-decoration: line-through;"><strong>Was:</strong> {{oldDate}} at {{oldTime}}</p>
  <p style="margin: 8px 0 4px; font-size: 16px;"><strong>Now:</strong> {{newDate}} at {{newTime}}</p>
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
</div>
{{teamsSection}}
<p>If you have any questions, feel free to reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  booking_recurring_series: {
    subject: "Your Upcoming {{sessionType}} Sessions with Life-Therapy",
    bodyHtml: `<p>Hi {{clientName}},</p>
<p>Your {{pattern}} <strong>{{sessionType}}</strong> sessions have been scheduled. Here are your upcoming dates:</p>
{{dateList}}
{{skippedNote}}
<p>Each session has a unique Microsoft Teams meeting link — you'll find it in your portal for each session.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{portalUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View My Sessions</a>
</div>
<p>If you need to reschedule any individual session, you can do so from your portal or contact me directly.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
  legal_document_updated: {
    subject: "Updated {{documentTitle}} — Please Review",
    bodyHtml: `<p>Hi {{firstName}},</p>
<p>We've updated our <strong>{{documentTitle}}</strong>. Here's a summary of what changed:</p>
<div style="background: #f9fafb; border-left: 4px solid #8BA889; border-radius: 4px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0; color: #555; font-style: italic;">"{{changeSummary}}"</p>
</div>
<p>Please log in to your portal to review and accept the updated agreement:</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{portalUrl}}/review-documents" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Review Now</a>
</div>
<p style="color: #dc2626; font-weight: 600;">This is required to continue booking sessions.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`,
  },
};

export default defaults;
