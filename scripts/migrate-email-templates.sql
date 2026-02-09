-- =============================================================================
-- Migration: Email Templates (admin-editable)
-- =============================================================================
-- Run in Supabase SQL Editor. Idempotent (safe to run multiple times).
-- Run enable-rls.sql after this to cover new tables.
-- =============================================================================

-- 1. NEW TABLE: email_templates
CREATE TABLE IF NOT EXISTS public.email_templates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  "bodyHtml" TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add unique constraint on key if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'email_templates_key_key'
  ) THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_key_key UNIQUE (key);
  END IF;
END $$;

-- =============================================================================
-- 2. SEED DATA: 10 Email Templates
-- =============================================================================

-- Booking Confirmation
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_booking_confirmation',
  'booking_confirmation',
  'Booking Confirmation',
  'booking',
  'Booking Confirmed: {{sessionType}} on {{date}}',
  '<p>Hi {{clientName}},</p>
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
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["clientName", "sessionType", "date", "time", "duration", "priceSection", "teamsSection", "confirmationUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Booking Notification (Admin)
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_booking_notification',
  'booking_notification',
  'Booking Notification (Admin)',
  'booking',
  'New Booking: {{sessionType}} — {{clientName}} ({{date}})',
  '<p>A new booking has been received:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{date}}</p>
  <p style="margin: 4px 0;"><strong>Time:</strong> {{time}}</p>
  <p style="margin: 4px 0;"><strong>Duration:</strong> {{duration}} min</p>
</div>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  {{clientDetails}}
</div>
{{teamsLink}}',
  '["sessionType", "clientName", "date", "time", "duration", "clientDetails", "teamsLink"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Booking Reminder
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_booking_reminder',
  'booking_reminder',
  'Booking Reminder',
  'booking',
  'Reminder: Your session is tomorrow at {{startTime}}',
  '<p>Hi {{clientName}},</p>
<p>This is a friendly reminder that your session is <strong>tomorrow</strong>.</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{date}}</p>
  <p style="margin: 4px 0;"><strong>Time:</strong> {{time}}</p>
</div>
{{teamsButton}}
<p>Looking forward to our session!</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["clientName", "sessionType", "date", "time", "startTime", "teamsButton"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Booking Cancellation
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_booking_cancellation',
  'booking_cancellation',
  'Booking Cancellation',
  'booking',
  'Session Cancelled: {{sessionType}} on {{date}}',
  '<p>Hi {{clientName}},</p>
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
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["clientName", "sessionType", "date", "time", "bookUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Order Confirmation
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_order_confirmation',
  'order_confirmation',
  'Order Confirmation',
  'order',
  'Order Confirmed: {{orderNumber}}',
  '<p>Hi {{firstName}},</p>
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
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["firstName", "orderNumber", "orderDate", "orderItemsTable", "subtotal", "discountRow", "total", "portalUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Welcome Email (Account Created)
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_account_created',
  'account_created',
  'Welcome Email',
  'onboarding',
  'Welcome to Life-Therapy!',
  '<p>Hi {{firstName}},</p>
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
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["firstName", "loginUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Account Provisioned
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_account_provisioned',
  'account_provisioned',
  'Account Provisioned',
  'onboarding',
  'Your Life-Therapy Account',
  '<p>Hi {{firstName}},</p>
<p>An account has been created for you on Life-Therapy. You can use the credentials below to log in and access your courses.</p>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #fff; padding: 2px 8px; border-radius: 4px; font-size: 15px;">{{tempPassword}}</code></p>
</div>
<p style="color: #dc2626; font-weight: 600;">You will be asked to change your password on first login.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{loginUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Log In Now</a>
</div>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["firstName", "tempPassword", "loginUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Course Completed
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_course_completed',
  'course_completed',
  'Course Completed',
  'course',
  'Congratulations! You completed {{courseTitle}}',
  '<p>Hi {{firstName}},</p>
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
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["firstName", "courseTitle", "certificateNumber", "portalUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Gift Received
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_gift_received',
  'gift_received',
  'Gift Received',
  'gift',
  E'\U0001F381 {{buyerName}} sent you a gift from Life-Therapy!',
  E'<p>Hi {{recipientName}},</p>
<p>Great news! <strong>{{buyerName}}</strong> has sent you a gift from Life-Therapy:</p>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">\U0001F381 {{itemTitle}}</p>
</div>
{{messageBlock}}
<p>To access your gift, click the button below. If you don&rsquo;t have an account yet, you&rsquo;ll be able to create one during the redemption process.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{redeemUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Redeem Your Gift</a>
</div>
<p style="font-size: 13px; color: #6b7280;">This gift doesn&rsquo;t expire \u2014 you can redeem it anytime.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["recipientName", "buyerName", "itemTitle", "messageBlock", "redeemUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Gift Delivered (Buyer)
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_gift_delivered_buyer',
  'gift_delivered_buyer',
  'Gift Delivered (Buyer)',
  'gift',
  'Your gift for {{recipientName}} has been delivered!',
  '<p>Hi {{buyerName}},</p>
<p>Just a quick note to let you know that your gift has been delivered!</p>
<div style="background: #f0f7f4; border-radius: 6px; padding: 20px; margin: 16px 0; text-align: center;">
  <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">Gift for {{recipientName}}</p>
  <p style="margin: 0; font-size: 18px; font-weight: 700; color: #333;">{{itemTitle}}</p>
</div>
<p>{{recipientName}} has been sent an email with instructions to redeem their gift.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["buyerName", "recipientName", "itemTitle"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;
