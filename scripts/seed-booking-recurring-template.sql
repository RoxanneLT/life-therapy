-- Seed: booking_recurring_series email template
INSERT INTO "email_templates" ("id", "key", "subject", "bodyHtml", "isActive", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  'booking_recurring_series',
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
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "email_templates" WHERE "key" = 'booking_recurring_series'
);
