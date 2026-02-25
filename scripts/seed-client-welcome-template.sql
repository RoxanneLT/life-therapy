-- =============================================================================
-- Seed: client_welcome email template
-- =============================================================================
-- Run in Supabase SQL Editor. Idempotent (safe to run multiple times).
-- =============================================================================

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
