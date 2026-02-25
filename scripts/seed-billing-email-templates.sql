-- =============================================================================
-- Seed: 4 billing email templates (invoice, payment_request, reminder, overdue)
-- =============================================================================
-- Run in Supabase SQL Editor. Idempotent (safe to run multiple times).
-- =============================================================================

-- 1. Invoice
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

-- 2. Payment Request
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_payment_request',
  'payment_request',
  'Payment Request',
  'billing',
  'Your Life Therapy sessions for {{month}}',
  $$<p>Hi {{billingName}},</p>
<p>Here is a summary of sessions for <strong>{{month}}</strong>:</p>
{{sessionSummary}}
<div style="background: #f9fafb; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 4px 0;"><strong>Total Due:</strong> {{total}}</p>
  <p style="margin: 4px 0;"><strong>Due Date:</strong> {{dueDate}}</p>
</div>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{paymentUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Pay Now</a>
</div>
<p>If you have any questions, please reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "month", "sessionSummary", "total", "dueDate", "paymentUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- 3. Payment Reminder
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_payment_request_reminder',
  'payment_request_reminder',
  'Payment Reminder',
  'billing',
  'Friendly reminder — payment due {{dueDate}}',
  $$<p>Hi {{billingName}},</p>
<p>Just a friendly reminder that your payment of <strong>{{total}}</strong> is due on <strong>{{dueDate}}</strong>.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{paymentUrl}}" style="display: inline-block; background: #8BA889; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Pay Now</a>
</div>
<p>If you&rsquo;ve already made payment, please disregard this message.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "total", "dueDate", "paymentUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;

-- 4. Payment Overdue
INSERT INTO public.email_templates (id, key, name, category, subject, "bodyHtml", variables, "isActive", "createdAt", "updatedAt")
VALUES (
  'et_payment_request_overdue',
  'payment_request_overdue',
  'Payment Overdue',
  'billing',
  'Payment overdue — Life Therapy {{month}}',
  $$<p>Hi {{billingName}},</p>
<p>We notice that your payment of <strong>{{total}}</strong> for <strong>{{month}}</strong> is now overdue.</p>
<p>Please arrange payment at your earliest convenience:</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{paymentUrl}}" style="display: inline-block; background: #dc2626; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">Pay Now</a>
</div>
<p>If you&rsquo;ve already made payment or have any questions, please reply to this email.</p>
<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>$$,
  '["billingName", "month", "total", "paymentUrl"]'::jsonb,
  true, now(), now()
)
ON CONFLICT (key) DO NOTHING;
