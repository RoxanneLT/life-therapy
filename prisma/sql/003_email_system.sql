-- =============================================================================
-- 003: Email System — Logs, Contacts, Campaigns, Templates + All Seeds
-- =============================================================================
-- Idempotent: safe to run multiple times.
-- DEPENDS ON: Prisma init migration (students table must exist)
-- Covers: email_logs table, student email preferences, contacts/campaigns
--         tables (mailing system foundation), email_templates table,
--         and all 20 email template seeds.
--
-- Billing templates use EFT banking details (not Paystack Pay Now links).
-- Variables: {{bankingDetails}}, {{paymentReference}}, {{sessionSummary}}
-- =============================================================================

-- ============================================================
-- EmailLog table + student email preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS "email_logs" (
  "id"           TEXT PRIMARY KEY,
  "templateKey"  TEXT,
  "to"           TEXT NOT NULL,
  "subject"      TEXT NOT NULL,
  "status"       TEXT NOT NULL,
  "error"        TEXT,
  "studentId"    TEXT REFERENCES "students"("id") ON DELETE SET NULL,
  "metadata"     JSONB,
  "sentAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "email_logs_to_idx" ON "email_logs"("to");
CREATE INDEX IF NOT EXISTS "email_logs_templateKey_idx" ON "email_logs"("templateKey");
CREATE INDEX IF NOT EXISTS "email_logs_studentId_idx" ON "email_logs"("studentId");
CREATE INDEX IF NOT EXISTS "email_logs_sentAt_idx" ON "email_logs"("sentAt");

-- Student email preferences
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "unsubscribeToken" TEXT;

UPDATE "students"
SET "unsubscribeToken" = gen_random_uuid()::text
WHERE "unsubscribeToken" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "students_unsubscribeToken_key" ON "students"("unsubscribeToken");

-- ============================================================
-- Mailing System — Contacts + Campaigns tables
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "ContactSource" AS ENUM ('newsletter', 'booking', 'student', 'import', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'sending', 'sent', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "contacts" (
  "id"               TEXT PRIMARY KEY,
  "email"            TEXT NOT NULL,
  "firstName"        TEXT,
  "lastName"         TEXT,
  "phone"            TEXT,
  "gender"           TEXT,
  "source"           "ContactSource" NOT NULL DEFAULT 'newsletter',
  "tags"             JSONB,
  "consentGiven"     BOOLEAN NOT NULL DEFAULT false,
  "consentDate"      TIMESTAMP(3),
  "consentMethod"    TEXT,
  "emailOptOut"      BOOLEAN NOT NULL DEFAULT false,
  "unsubscribeToken" TEXT NOT NULL,
  "studentId"        TEXT REFERENCES "students"("id") ON DELETE SET NULL,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_email_key" ON "contacts"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_unsubscribeToken_key" ON "contacts"("unsubscribeToken");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_studentId_key" ON "contacts"("studentId");
CREATE INDEX IF NOT EXISTS "contacts_source_idx" ON "contacts"("source");
CREATE INDEX IF NOT EXISTS "contacts_emailOptOut_idx" ON "contacts"("emailOptOut");

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id"              TEXT PRIMARY KEY,
  "name"            TEXT NOT NULL,
  "subject"         TEXT NOT NULL,
  "bodyHtml"        TEXT NOT NULL,
  "status"          "CampaignStatus" NOT NULL DEFAULT 'draft',
  "filterSource"    TEXT,
  "filterTags"      JSONB,
  "totalRecipients" INTEGER NOT NULL DEFAULT 0,
  "sentCount"       INTEGER NOT NULL DEFAULT 0,
  "failedCount"     INTEGER NOT NULL DEFAULT 0,
  "sentAt"          TIMESTAMP(3),
  "sentById"        TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "campaigns_status_idx" ON "campaigns"("status");

-- Cleanup: Drop unused Mailchimp columns from site_settings (if they exist)
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "mailchimpApiKey";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "mailchimpAudienceId";
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "mailchimpServer";

-- ============================================================
-- email_templates table
-- ============================================================

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'email_templates_key_key'
  ) THEN
    ALTER TABLE public.email_templates ADD CONSTRAINT email_templates_key_key UNIQUE (key);
  END IF;
END $$;

-- ============================================================
-- Seed: Core email templates
-- ============================================================

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

-- Booking Rescheduled
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_booking_reschedule',
  'booking_reschedule',
  'Booking Rescheduled',
  'booking',
  'Session Rescheduled: {{sessionType}} — New Date {{newDate}}',
  '<p>Hi {{clientName}},</p>
<p>Your session has been rescheduled. Here are the updated details:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0; color: #6b7280; text-decoration: line-through;"><strong>Was:</strong> {{oldDate}} at {{oldTime}}</p>
  <p style="margin: 8px 0 4px; font-size: 16px;"><strong>Now:</strong> {{newDate}} at {{newTime}}</p>
  <p style="margin: 4px 0;"><strong>Session:</strong> {{sessionType}}</p>
</div>
{{teamsSection}}
<p>If you have any questions, feel free to reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["clientName", "sessionType", "oldDate", "oldTime", "newDate", "newTime", "teamsSection"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Booking Recurring Series
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_booking_recurring_series',
  'booking_recurring_series',
  'Booking Recurring Series',
  'booking',
  'Your Upcoming {{sessionType}} Sessions with Life-Therapy',
  '<p>Hi {{clientName}},</p>
<p>Your {{pattern}} <strong>{{sessionType}}</strong> sessions have been scheduled. Here are your upcoming dates:</p>
{{dateList}}
{{skippedNote}}
<p>Each session has a unique Microsoft Teams meeting link — you''ll find it in your portal for each session.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{portalUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">View My Sessions</a>
</div>
<p>If you need to reschedule any individual session, you can do so from your portal or contact me directly.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["clientName", "pattern", "sessionType", "dateList", "skippedNote", "portalUrl"]'::jsonb,
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

-- Password Changed
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_password_changed',
  'password_changed',
  'Password Changed',
  'onboarding',
  'Your Life-Therapy password has been changed',
  '<p>Hi {{firstName}},</p>
<p>Your password has been successfully changed.</p>
<p>If you did not make this change, please contact us immediately at <a href="mailto:hello@life-therapy.co.za" style="color: #8BA889;">hello@life-therapy.co.za</a>.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["firstName"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Client Welcome (activated as client)
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_client_welcome',
  'client_welcome',
  'Client Welcome',
  'account',
  'Welcome to Life-Therapy — You''re All Set!',
  '<p>Hi {{clientName}},</p>
<p>Welcome! You are now an active client at Life-Therapy. We''re looking forward to supporting you on your journey.</p>
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
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["clientName", "portalUrl", "creditsInfo"]'::jsonb,
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
<p style="font-size: 13px; color: #6b7280;">This gift doesn&rsquo;t expire — you can redeem it anytime.</p>
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

-- Legal Document Updated
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_legal_document_updated',
  'legal_document_updated',
  'Legal Document Updated',
  'legal',
  'Updated {{documentTitle}} — Please Review',
  '<p>Hi {{firstName}},</p>
<p>We''ve updated our <strong>{{documentTitle}}</strong>. Here''s a summary of what changed:</p>
<div style="background: #f9fafb; border-left: 4px solid #8BA889; border-radius: 4px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0; color: #555; font-style: italic;">&ldquo;{{changeSummary}}&rdquo;</p>
</div>
<p>Please log in to your portal to review and accept the updated agreement:</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{portalUrl}}/review-documents" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Review Now</a>
</div>
<p style="color: #dc2626; font-weight: 600;">This is required to continue booking sessions.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>',
  '["firstName", "documentTitle", "changeSummary", "portalUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- Seed: Billing email templates (EFT payment details)
-- Uses {{bankingDetails}}, {{paymentReference}}, {{sessionSummary}}
-- NOT Paystack Pay Now links
-- ============================================================

-- Invoice
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_invoice',
  'invoice',
  'Invoice',
  'billing',
  'Life Therapy Invoice {{invoiceNumber}}',
  $$<p>Hi {{billingName}},</p>
<p>Please find your invoice attached.</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Invoice:</strong> {{invoiceNumber}}</p>
  <p style="margin: 4px 0;"><strong>Date:</strong> {{invoiceDate}}</p>
  <p style="margin: 4px 0;"><strong>Amount:</strong> {{total}}</p>
</div>
<p>Your invoice is attached as a PDF to this email.</p>
<p>If you have any questions about this invoice, please reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "invoiceNumber", "invoiceDate", "total"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Payment Request
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_payment_request',
  'payment_request',
  'Payment Request',
  'billing',
  'Your Life Therapy sessions for {{month}}',
  $$<p>Hi {{billingName}},</p>
<p>Here is a summary of your sessions for <strong>{{month}}</strong>:</p>
{{sessionSummary}}
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Total Due:</strong> {{total}}</p>
  <p style="margin: 4px 0;"><strong>Due Date:</strong> {{dueDate}}</p>
  <p style="margin: 4px 0;"><strong>Payment Reference:</strong> {{paymentReference}}</p>
</div>
{{bankingDetails}}
<p style="font-size: 13px; color: #6b7280;">A detailed pro-forma invoice is attached to this email for your records.</p>
<p>If you have any questions, please reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "month", "sessionSummary", "total", "dueDate", "paymentReference", "bankingDetails"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Payment Reminder
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_payment_request_reminder',
  'payment_request_reminder',
  'Payment Reminder',
  'billing',
  'Friendly reminder — payment due {{dueDate}}',
  $$<p>Hi {{billingName}},</p>
<p>Just a friendly reminder that your payment of <strong>{{total}}</strong> is due on <strong>{{dueDate}}</strong>.</p>
{{sessionSummary}}
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Payment Reference:</strong> {{paymentReference}}</p>
</div>
{{bankingDetails}}
<p style="font-size: 13px; color: #6b7280;">The pro-forma invoice is attached for your convenience.</p>
<p>If you&rsquo;ve already made payment, please disregard this message.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "month", "sessionSummary", "total", "dueDate", "paymentReference", "bankingDetails"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Payment Due Today
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_payment_request_due_today',
  'payment_request_due_today',
  'Payment Due Today',
  'billing',
  'Payment due today — Life Therapy',
  $$<p>Hi {{billingName}},</p>
<p>This is a reminder that your payment of <strong>{{total}}</strong> is <strong>due today</strong>.</p>
{{sessionSummary}}
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Payment Reference:</strong> {{paymentReference}}</p>
</div>
{{bankingDetails}}
<p style="font-size: 13px; color: #6b7280;">The pro-forma invoice is attached for your convenience.</p>
<p>If you&rsquo;ve already made payment, please disregard this message.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "month", "sessionSummary", "total", "paymentReference", "bankingDetails"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- Payment Overdue
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_payment_request_overdue',
  'payment_request_overdue',
  'Payment Overdue',
  'billing',
  'Payment overdue — Life Therapy {{month}}',
  $$<p>Hi {{billingName}},</p>
<p>We notice that your payment of <strong>{{total}}</strong> for <strong>{{month}}</strong> is now overdue.</p>
{{sessionSummary}}
<p>Please arrange payment at your earliest convenience using the details below:</p>
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Payment Reference:</strong> {{paymentReference}}</p>
</div>
{{bankingDetails}}
<p style="font-size: 13px; color: #6b7280;">The pro-forma invoice is attached for your records.</p>
<p>If you&rsquo;ve already made payment or have any questions, please reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "month", "sessionSummary", "total", "paymentReference", "bankingDetails"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;
