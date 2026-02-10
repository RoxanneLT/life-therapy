-- ============================================================
-- Seed: Re-Engagement Campaign for Existing Sage Clients
-- Run in Supabase SQL Editor
-- Creates a 5-step multi-step campaign in "draft" status
-- Target audience: contacts tagged "sage-import"
-- ============================================================

-- 1. Create the campaign (draft — you schedule it when ready)
INSERT INTO "campaigns" (
  "id", "name", "status", "isMultiStep",
  "filterTags", "totalRecipients", "sentCount", "failedCount",
  "createdAt", "updatedAt"
) VALUES (
  'campaign_reengagement_sage',
  'Re-Engage: Existing Clients (Sage Import)',
  'draft',
  true,
  '["sage-import"]',
  0, 0, 0,
  NOW(), NOW()
)
ON CONFLICT ("id") DO NOTHING;

-- 2. Create the 5 email steps
--    dayOffset = days after campaign activation to send each email
--    Placeholders: {{firstName}}, {{unsubscribeUrl}}

INSERT INTO "campaign_emails" ("id", "campaignId", "step", "dayOffset", "subject", "previewText", "bodyHtml", "ctaText", "ctaUrl", "isActive", "createdAt", "updatedAt")
VALUES

-- Step 1: Day 0 — Warm reconnection
(
  'ce_reeng_0',
  'campaign_reengagement_sage',
  0,
  0,
  'Hi {{firstName}} — we''ve missed you at Life Therapy',
  'A lot has changed since we last connected. Come see what''s new.',
  '<p>Hi {{firstName}},</p>
<p>It''s been a while since your last session, and I just wanted to reach out personally.</p>
<p>Life Therapy has grown — we''ve launched <strong>online self-paced courses</strong> and <strong>short courses</strong> that you can work through at your own pace, from anywhere. Topics range from emotional resilience and relationship dynamics to self-worth and boundary-setting.</p>
<p>Whether you''re looking to continue your growth journey or simply curious about what''s new, I''d love to have you back.</p>
<p>Warm regards,<br/>Sofia Hart<br/><em>Life Therapy</em></p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">If you''d prefer not to hear from us, you can <a href="{{unsubscribeUrl}}" style="color: #888;">unsubscribe here</a>.</p>',
  'See What''s New',
  '/courses',
  true,
  NOW(), NOW()
),

-- Step 2: Day 5 — Value-first (free resource angle)
(
  'ce_reeng_1',
  'campaign_reengagement_sage',
  1,
  5,
  '{{firstName}}, a free consultation is still on the table',
  'Book a complimentary 30-minute session — no strings attached.',
  '<p>Hi {{firstName}},</p>
<p>I know life gets busy, and sometimes therapy takes a back seat. That''s completely okay.</p>
<p>If you''ve been thinking about checking in — even just to see where you''re at — I''d like to offer you a <strong>complimentary 30-minute consultation</strong>. No pressure, no commitment. Just a conversation.</p>
<p>Sometimes one session is all it takes to reignite clarity.</p>
<p>With care,<br/>Sofia Hart</p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">Not interested? <a href="{{unsubscribeUrl}}" style="color: #888;">Unsubscribe</a> and we won''t email you again.</p>',
  'Book Free Consultation',
  '/book',
  true,
  NOW(), NOW()
),

-- Step 3: Day 12 — Social proof / testimonial
(
  'ce_reeng_2',
  'campaign_reengagement_sage',
  2,
  12,
  'What other clients are saying about their journey',
  'Real stories from people who came back to therapy.',
  '<p>Hi {{firstName}},</p>
<p>I wanted to share something that might resonate with you.</p>
<p>Many clients who took a break from therapy have come back — not because things got worse, but because they realised growth doesn''t have an expiry date.</p>
<blockquote style="border-left: 3px solid #1E4B6E; padding: 12px 16px; margin: 16px 0; background: #f8f9fa; font-style: italic;">
"I thought I was done with therapy, but coming back after a year made me realise how much I''d grown — and how much more was possible."
</blockquote>
<p>Your journey is still unfolding. If you''re ready for the next chapter, we''re here.</p>
<p>Sofia Hart</p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">Don''t want these emails? <a href="{{unsubscribeUrl}}" style="color: #888;">Opt out here</a>.</p>',
  'Read More Stories',
  '/testimonials',
  true,
  NOW(), NOW()
),

-- Step 4: Day 20 — Course highlight / educational value
(
  'ce_reeng_3',
  'campaign_reengagement_sage',
  3,
  20,
  '{{firstName}}, have you tried our self-paced courses?',
  'Work through powerful therapy content in your own time.',
  '<p>Hi {{firstName}},</p>
<p>Not everyone needs weekly sessions — and that''s exactly why I created our <strong>online courses</strong>.</p>
<p>They''re designed to give you the same depth and insight as therapy, but on your schedule. Each course includes video lessons, reflective exercises, and practical worksheets.</p>
<p>Some of our most popular topics:</p>
<ul>
<li><strong>Understanding Your Emotional Patterns</strong></li>
<li><strong>Building Healthier Relationships</strong></li>
<li><strong>Reclaiming Your Self-Worth</strong></li>
</ul>
<p>You can also try a <strong>short course</strong> (a single module) if you want to dip your toes in first.</p>
<p>Sofia Hart</p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">Prefer not to receive these? <a href="{{unsubscribeUrl}}" style="color: #888;">Unsubscribe</a>.</p>',
  'Browse Courses',
  '/courses',
  true,
  NOW(), NOW()
),

-- Step 5: Day 30 — Final gentle nudge + clear opt-out
(
  'ce_reeng_4',
  'campaign_reengagement_sage',
  4,
  30,
  'Last note from me, {{firstName}}',
  'This is my final check-in — no more emails after this unless you want them.',
  '<p>Hi {{firstName}},</p>
<p>This is my last email in this series — I promise.</p>
<p>I just wanted you to know that whenever you''re ready, Life Therapy is here. Whether it''s a session, a course, or even just browsing what''s available, there''s no expiry on your welcome.</p>
<p>If you''d like to stay connected, you don''t need to do anything — we''ll include you in our occasional newsletter with helpful insights and updates.</p>
<p>If not, simply click below and we''ll remove you from all future emails. No hard feelings, truly.</p>
<p>Wishing you well on your journey,<br/>Sofia Hart<br/><em>Life Therapy</em></p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;"><a href="{{unsubscribeUrl}}" style="color: #888;">Unsubscribe from all emails</a></p>',
  'Stay Connected',
  '/courses',
  true,
  NOW(), NOW()
)

ON CONFLICT ("id") DO NOTHING;
