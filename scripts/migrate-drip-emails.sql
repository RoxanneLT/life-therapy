-- ============================================================
-- Migration: Drip Email System (Automated Nurture Sequence)
-- Run in Supabase SQL Editor
-- ============================================================

-- Enum
DO $$ BEGIN
  CREATE TYPE "DripEmailType" AS ENUM ('onboarding', 'newsletter');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drip Emails table (stores 36 email definitions)
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

-- Drip Progress table (tracks per-contact position)
CREATE TABLE IF NOT EXISTS "drip_progress" (
  "id"           TEXT PRIMARY KEY,
  "contactId"    TEXT NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
  "currentPhase" "DripEmailType" NOT NULL DEFAULT 'onboarding',
  "currentStep"  INTEGER NOT NULL DEFAULT 0,
  "lastSentAt"   TIMESTAMP(3),
  "completedAt"  TIMESTAMP(3),
  "isPaused"     BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "drip_progress_contactId_key" ON "drip_progress"("contactId");
CREATE INDEX IF NOT EXISTS "drip_progress_phase_step_idx" ON "drip_progress"("currentPhase", "currentStep");
CREATE INDEX IF NOT EXISTS "drip_progress_isPaused_idx" ON "drip_progress"("isPaused");

-- ============================================================
-- Seed: 36 drip email placeholders
-- Actual content loaded from lib/drip-email-defaults.ts via admin
-- These are minimal placeholders so the table isn't empty
-- ============================================================

-- Onboarding emails (12)
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

-- Newsletter emails (24)
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
