-- =============================================================================
-- 004: Campaigns — Multi-Step Campaigns, Drip Emails, Reengagement Seed
-- =============================================================================
-- Idempotent: safe to run multiple times.
-- DEPENDS ON: 003_email_system.sql (campaigns, email_logs tables)
-- Covers: multi-step campaign extensions, drip email system (2-year sequence),
--         and the initial re-engagement campaign for Sage-imported clients.
-- =============================================================================

-- ============================================================
-- Multi-Step Scheduled Campaigns
-- ============================================================

-- Evolve CampaignStatus enum — add new values
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE "CampaignStatus" ADD VALUE IF NOT EXISTS 'paused';

-- Add new columns to campaigns table
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "isMultiStep"  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "startDate"    TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "activatedAt"  TIMESTAMP(3);
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "completedAt"  TIMESTAMP(3);

-- Make subject and bodyHtml nullable for multi-step campaigns
ALTER TABLE "campaigns" ALTER COLUMN "subject" DROP NOT NULL;
ALTER TABLE "campaigns" ALTER COLUMN "bodyHtml" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "campaigns_startDate_idx" ON "campaigns"("startDate");

-- CampaignEmail table (child emails in a campaign sequence)
CREATE TABLE IF NOT EXISTS "campaign_emails" (
  "id"          TEXT PRIMARY KEY,
  "campaignId"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "step"        INTEGER NOT NULL,
  "dayOffset"   INTEGER NOT NULL,
  "subject"     TEXT NOT NULL,
  "previewText" TEXT,
  "bodyHtml"    TEXT NOT NULL,
  "ctaText"     TEXT,
  "ctaUrl"      TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_emails_campaignId_step_key"
  ON "campaign_emails"("campaignId", "step");
CREATE INDEX IF NOT EXISTS "campaign_emails_campaignId_idx"
  ON "campaign_emails"("campaignId");

-- CampaignProgress table (per-student tracking through campaign)
CREATE TABLE IF NOT EXISTS "campaign_progress" (
  "id"          TEXT PRIMARY KEY,
  "campaignId"  TEXT NOT NULL REFERENCES "campaigns"("id") ON DELETE CASCADE,
  "studentId"   TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "currentStep" INTEGER NOT NULL DEFAULT 0,
  "lastSentAt"  TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "isPaused"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "campaign_progress_campaignId_studentId_key"
  ON "campaign_progress"("campaignId", "studentId");
CREATE INDEX IF NOT EXISTS "campaign_progress_campaignId_completedAt_idx"
  ON "campaign_progress"("campaignId", "completedAt");
CREATE INDEX IF NOT EXISTS "campaign_progress_studentId_idx"
  ON "campaign_progress"("studentId");

-- Email tracking fields on EmailLog
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "trackingId"  TEXT;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "openedAt"    TIMESTAMP(3);
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "opensCount"  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clickedAt"   TIMESTAMP(3);
ALTER TABLE "email_logs" ADD COLUMN IF NOT EXISTS "clicksCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "email_logs_trackingId_key"
  ON "email_logs"("trackingId") WHERE "trackingId" IS NOT NULL;

-- Student engagement pause fields (contacts table was merged into students and dropped)
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailPaused"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailPausedAt"    TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "emailPauseReason" TEXT;

CREATE INDEX IF NOT EXISTS "students_emailPaused_idx" ON "students"("emailPaused");

-- ============================================================
-- Drip Email System (Automated 2-Year Nurture Sequence)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "DripEmailType" AS ENUM ('onboarding', 'newsletter');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drip Emails table (stores email definitions)
CREATE TABLE IF NOT EXISTS "drip_emails" (
  "id"          TEXT PRIMARY KEY,
  "type"        "DripEmailType" NOT NULL,
  "step"        INTEGER NOT NULL,
  "dayOffset"   INTEGER NOT NULL,
  "subject"     TEXT NOT NULL,
  "previewText" TEXT,
  "bodyHtml"    TEXT NOT NULL,
  "ctaText"     TEXT,
  "ctaUrl"      TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "drip_emails_type_step_key" ON "drip_emails"("type", "step");
CREATE INDEX IF NOT EXISTS "drip_emails_type_idx" ON "drip_emails"("type");

-- Drip Progress table (tracks per-student position)
CREATE TABLE IF NOT EXISTS "drip_progress" (
  "id"           TEXT PRIMARY KEY,
  "studentId"    TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "currentPhase" "DripEmailType" NOT NULL DEFAULT 'onboarding',
  "currentStep"  INTEGER NOT NULL DEFAULT 0,
  "lastSentAt"   TIMESTAMP(3),
  "completedAt"  TIMESTAMP(3),
  "isPaused"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "drip_progress_studentId_key" ON "drip_progress"("studentId");
CREATE INDEX IF NOT EXISTS "drip_progress_phase_step_idx" ON "drip_progress"("currentPhase", "currentStep");
CREATE INDEX IF NOT EXISTS "drip_progress_isPaused_idx" ON "drip_progress"("isPaused");

-- ============================================================
-- Seed: Onboarding drip emails (12 emails, steps 0-11)
-- Actual content loaded from lib/drip-email-defaults.ts via admin
-- ============================================================

INSERT INTO "drip_emails" ("id", "type", "step", "dayOffset", "subject", "bodyHtml")
VALUES
  ('drip_onb_00', 'onboarding', 0,  0,  'Welcome to Life-Therapy -- Your Free Assessment Is Here', '<p>Welcome! Your content will be loaded from the admin panel.</p>'),
  ('drip_onb_01', 'onboarding', 1,  2,  'Why I Became a Life Coach (It Wasn''t the Plan)', '<p>Content placeholder.</p>'),
  ('drip_onb_02', 'onboarding', 2,  4,  'The One Thing Most People Get Wrong About Self-Esteem', '<p>Content placeholder.</p>'),
  ('drip_onb_03', 'onboarding', 3,  7,  'Try This: A 5-Minute Exercise That Shifts Your Self-Talk', '<p>Content placeholder.</p>'),
  ('drip_onb_04', 'onboarding', 4,  9,  'Your Inner Critic Is Lying to You -- Here''s Proof', '<p>Content placeholder.</p>'),
  ('drip_onb_05', 'onboarding', 5,  11, 'The 5-Minute Morning Practice That Builds Real Confidence', '<p>Content placeholder.</p>'),
  ('drip_onb_06', 'onboarding', 6,  14, '"She Helped Me Believe in Myself Again" -- Real Stories', '<p>Content placeholder.</p>'),
  ('drip_onb_07', 'onboarding', 7,  16, 'Ready to Go Deeper? Here Are Your Options', '<p>Content placeholder.</p>'),
  ('drip_onb_08', 'onboarding', 8,  19, '3 Boundaries That Will Change Your Relationships', '<p>Content placeholder.</p>'),
  ('drip_onb_09', 'onboarding', 9,  22, 'The Confidence Myth Nobody Talks About', '<p>Content placeholder.</p>'),
  ('drip_onb_10', 'onboarding', 10, 25, 'Your Personal Growth Toolkit -- Curated Just for You', '<p>Content placeholder.</p>'),
  ('drip_onb_11', 'onboarding', 11, 30, 'What''s Next? Your Journey Continues -- Here''s How', '<p>Content placeholder.</p>')
ON CONFLICT ("type", "step") DO NOTHING;

-- ============================================================
-- Seed: Newsletter drip emails Year 1 (24 emails, steps 0-23)
-- ============================================================

INSERT INTO "drip_emails" ("id", "type", "step", "dayOffset", "subject", "bodyHtml")
VALUES
  ('drip_nl_00', 'newsletter', 0,  44,  'The Self-Esteem Audit: Where Do You Really Stand?', '<p>Content placeholder.</p>'),
  ('drip_nl_01', 'newsletter', 1,  58,  'The Hidden Cost of People-Pleasing', '<p>Content placeholder.</p>'),
  ('drip_nl_02', 'newsletter', 2,  72,  '3 Signs You''re Self-Sabotaging (Without Realising It)', '<p>Content placeholder.</p>'),
  ('drip_nl_03', 'newsletter', 3,  86,  'A Letter to You on a Hard Day', '<p>Content placeholder.</p>'),
  ('drip_nl_04', 'newsletter', 4,  100, 'How to Stop Comparing Yourself to Everyone Online', '<p>Content placeholder.</p>'),
  ('drip_nl_05', 'newsletter', 5,  114, 'What I''ve Learned From 500+ Coaching Sessions', '<p>Content placeholder.</p>'),
  ('drip_nl_06', 'newsletter', 6,  128, 'The Assertiveness Cheat Sheet You''ll Actually Use', '<p>Content placeholder.</p>'),
  ('drip_nl_07', 'newsletter', 7,  142, 'When Growth Feels Like Going Backwards', '<p>Content placeholder.</p>'),
  ('drip_nl_08', 'newsletter', 8,  156, '5 Journal Prompts for When You Feel Stuck', '<p>Content placeholder.</p>'),
  ('drip_nl_09', 'newsletter', 9,  170, 'What Nobody Tells You About Building Confidence at Work', '<p>Content placeholder.</p>'),
  ('drip_nl_10', 'newsletter', 10, 184, 'The Relationship Between Self-Esteem and Your Relationships', '<p>Content placeholder.</p>'),
  ('drip_nl_11', 'newsletter', 11, 198, 'Halfway Check-In: How Are You Really Doing?', '<p>Content placeholder.</p>'),
  ('drip_nl_12', 'newsletter', 12, 212, 'Why ''Self-Care'' Isn''t What You Think It Is', '<p>Content placeholder.</p>'),
  ('drip_nl_13', 'newsletter', 13, 226, 'The Power of ''Good Enough''', '<p>Content placeholder.</p>'),
  ('drip_nl_14', 'newsletter', 14, 240, 'A Client''s Story: From People-Pleaser to Self-Advocate', '<p>Content placeholder.</p>'),
  ('drip_nl_15', 'newsletter', 15, 254, 'Your Body Keeps the Score (And What to Do About It)', '<p>Content placeholder.</p>'),
  ('drip_nl_16', 'newsletter', 16, 268, 'How to Have the Conversation You''ve Been Avoiding', '<p>Content placeholder.</p>'),
  ('drip_nl_17', 'newsletter', 17, 282, 'What I Wish I''d Known at 25 (and 35, and Yesterday)', '<p>Content placeholder.</p>'),
  ('drip_nl_18', 'newsletter', 18, 296, 'How to Deal with Someone Who Doesn''t Respect Your Boundaries', '<p>Content placeholder.</p>'),
  ('drip_nl_19', 'newsletter', 19, 310, 'The Gift of Being a Highly Sensitive Person', '<p>Content placeholder.</p>'),
  ('drip_nl_20', 'newsletter', 20, 324, 'A Simple Framework for Making Hard Decisions', '<p>Content placeholder.</p>'),
  ('drip_nl_21', 'newsletter', 21, 338, 'Why You Don''t Need to ''Fix'' Yourself', '<p>Content placeholder.</p>'),
  ('drip_nl_22', 'newsletter', 22, 352, 'Your Growth This Year -- A Celebration', '<p>Content placeholder.</p>'),
  ('drip_nl_23', 'newsletter', 23, 366, 'What''s Next? Your Second Year Starts Here', '<p>Content placeholder.</p>')
ON CONFLICT ("type", "step") DO NOTHING;

-- ============================================================
-- Seed: Newsletter drip emails Year 2 (24 emails, steps 24-47)
-- Day offsets continue biweekly from Year 1's last (Day 366)
-- ============================================================

INSERT INTO "drip_emails" ("id", "type", "step", "dayOffset", "subject", "bodyHtml")
VALUES
  ('drip_nl_24', 'newsletter', 24, 380, 'The Identity Crisis Nobody Warns You About', '<p>Content placeholder.</p>'),
  ('drip_nl_25', 'newsletter', 25, 394, 'Grieving the Person You Used to Be', '<p>Content placeholder.</p>'),
  ('drip_nl_26', 'newsletter', 26, 408, 'When Your Growth Makes Others Uncomfortable', '<p>Content placeholder.</p>'),
  ('drip_nl_27', 'newsletter', 27, 422, 'The Connection Between Money and Self-Worth', '<p>Content placeholder.</p>'),
  ('drip_nl_28', 'newsletter', 28, 436, 'What Your Anger Is Actually Telling You', '<p>Content placeholder.</p>'),
  ('drip_nl_29', 'newsletter', 29, 450, 'The Art of Receiving (Not Just Giving)', '<p>Content placeholder.</p>'),
  ('drip_nl_30', 'newsletter', 30, 464, 'Reparenting: Giving Yourself What You Didn''t Get', '<p>Content placeholder.</p>'),
  ('drip_nl_31', 'newsletter', 31, 478, 'When Healing Feels Like Falling Apart', '<p>Content placeholder.</p>'),
  ('drip_nl_32', 'newsletter', 32, 492, 'Your Attachment Style Is Running the Show', '<p>Content placeholder.</p>'),
  ('drip_nl_33', 'newsletter', 33, 506, 'The Loneliness of Growth (And What to Do About It)', '<p>Content placeholder.</p>'),
  ('drip_nl_34', 'newsletter', 34, 520, 'How to Trust Again After Being Let Down', '<p>Content placeholder.</p>'),
  ('drip_nl_35', 'newsletter', 35, 534, '18-Month Check-In: Look at Who You''re Becoming', '<p>Content placeholder.</p>'),
  ('drip_nl_36', 'newsletter', 36, 548, 'The Difference Between Being Alone and Being Lonely', '<p>Content placeholder.</p>'),
  ('drip_nl_37', 'newsletter', 37, 562, 'Your Worth Is Not Your Output', '<p>Content placeholder.</p>'),
  ('drip_nl_38', 'newsletter', 38, 576, 'The Conversations You Need to Have With Your Parents', '<p>Content placeholder.</p>'),
  ('drip_nl_39', 'newsletter', 39, 590, 'Finding Purpose When You''ve Outgrown Your Old One', '<p>Content placeholder.</p>'),
  ('drip_nl_40', 'newsletter', 40, 604, 'How to Stop Absorbing Other People''s Stress', '<p>Content placeholder.</p>'),
  ('drip_nl_41', 'newsletter', 41, 618, 'The Power of Letting People Be Wrong About You', '<p>Content placeholder.</p>'),
  ('drip_nl_42', 'newsletter', 42, 632, 'Building a Life You Don''t Need a Holiday From', '<p>Content placeholder.</p>'),
  ('drip_nl_43', 'newsletter', 43, 646, 'When the Relationship You Need to Fix Is With Yourself', '<p>Content placeholder.</p>'),
  ('drip_nl_44', 'newsletter', 44, 660, 'The Courage to Be Disliked', '<p>Content placeholder.</p>'),
  ('drip_nl_45', 'newsletter', 45, 674, 'What You Practise Grows Stronger', '<p>Content placeholder.</p>'),
  ('drip_nl_46', 'newsletter', 46, 688, 'Two Years of Growth -- A Love Letter to You', '<p>Content placeholder.</p>'),
  ('drip_nl_47', 'newsletter', 47, 702, 'What Comes After? Your Next Chapter Starts Now', '<p>Content placeholder.</p>')
ON CONFLICT ("type", "step") DO NOTHING;

-- ============================================================
-- Seed: Re-Engagement Campaign for Existing Sage Clients
-- Draft status — schedule manually when ready
-- Target: contacts tagged "sage-import"
-- ============================================================

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

INSERT INTO "campaign_emails" ("id", "campaignId", "step", "dayOffset", "subject", "previewText", "bodyHtml", "ctaText", "ctaUrl", "isActive", "createdAt", "updatedAt")
VALUES

('ce_reeng_0', 'campaign_reengagement_sage', 0, 0,
  'Hi {{firstName}} — we''ve missed you at Life Therapy',
  'A lot has changed since we last connected. Come see what''s new.',
  '<p>Hi {{firstName}},</p>
<p>It''s been a while since your last session, and I just wanted to reach out personally.</p>
<p>Life Therapy has grown — we''ve launched <strong>online self-paced courses</strong> and <strong>short courses</strong> that you can work through at your own pace, from anywhere. Topics range from emotional resilience and relationship dynamics to self-worth and boundary-setting.</p>
<p>Whether you''re looking to continue your growth journey or simply curious about what''s new, I''d love to have you back.</p>
<p>Warm regards,<br/>Roxanne Bouwer<br/><em>Life Therapy</em></p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">If you''d prefer not to hear from us, you can <a href="{{unsubscribeUrl}}" style="color: #888;">unsubscribe here</a>.</p>',
  'See What''s New', '/courses', true, NOW(), NOW()),

('ce_reeng_1', 'campaign_reengagement_sage', 1, 5,
  '{{firstName}}, a free consultation is still on the table',
  'Book a complimentary 30-minute session — no strings attached.',
  '<p>Hi {{firstName}},</p>
<p>I know life gets busy, and sometimes therapy takes a back seat. That''s completely okay.</p>
<p>If you''ve been thinking about checking in — even just to see where you''re at — I''d like to offer you a <strong>complimentary 30-minute consultation</strong>. No pressure, no commitment. Just a conversation.</p>
<p>Sometimes one session is all it takes to reignite clarity.</p>
<p>With care,<br/>Roxanne Bouwer</p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">Not interested? <a href="{{unsubscribeUrl}}" style="color: #888;">Unsubscribe</a> and we won''t email you again.</p>',
  'Book Free Consultation', '/book', true, NOW(), NOW()),

('ce_reeng_2', 'campaign_reengagement_sage', 2, 12,
  'What other clients are saying about their journey',
  'Real stories from people who came back to therapy.',
  '<p>Hi {{firstName}},</p>
<p>I wanted to share something that might resonate with you.</p>
<p>Many clients who took a break from therapy have come back — not because things got worse, but because they realised growth doesn''t have an expiry date.</p>
<blockquote style="border-left: 3px solid #1E4B6E; padding: 12px 16px; margin: 16px 0; background: #f8f9fa; font-style: italic;">
"I thought I was done with therapy, but coming back after a year made me realise how much I''d grown — and how much more was possible."
</blockquote>
<p>Your journey is still unfolding. If you''re ready for the next chapter, we''re here.</p>
<p>Roxanne Bouwer</p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">Don''t want these emails? <a href="{{unsubscribeUrl}}" style="color: #888;">Opt out here</a>.</p>',
  'Read More Stories', '/testimonials', true, NOW(), NOW()),

('ce_reeng_3', 'campaign_reengagement_sage', 3, 20,
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
<p>Roxanne Bouwer</p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;">Prefer not to receive these? <a href="{{unsubscribeUrl}}" style="color: #888;">Unsubscribe</a>.</p>',
  'Browse Courses', '/courses', true, NOW(), NOW()),

('ce_reeng_4', 'campaign_reengagement_sage', 4, 30,
  'Last note from me, {{firstName}}',
  'This is my final check-in — no more emails after this unless you want them.',
  '<p>Hi {{firstName}},</p>
<p>This is my last email in this series — I promise.</p>
<p>I just wanted you to know that whenever you''re ready, Life Therapy is here. Whether it''s a session, a course, or even just browsing what''s available, there''s no expiry on your welcome.</p>
<p>If you''d like to stay connected, you don''t need to do anything — we''ll include you in our occasional newsletter with helpful insights and updates.</p>
<p>If not, simply click below and we''ll remove you from all future emails. No hard feelings, truly.</p>
<p>Wishing you well on your journey,<br/>Roxanne Bouwer<br/><em>Life Therapy</em></p>
<hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
<p style="font-size: 12px; color: #888;"><a href="{{unsubscribeUrl}}" style="color: #888;">Unsubscribe from all emails</a></p>',
  'Stay Connected', '/courses', true, NOW(), NOW())

ON CONFLICT ("id") DO NOTHING;
