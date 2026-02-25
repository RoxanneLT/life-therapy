-- =============================================================================
-- Seed: booking_reschedule email template
-- =============================================================================
-- Run in Supabase SQL Editor. Idempotent (safe to run multiple times).
-- =============================================================================

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
