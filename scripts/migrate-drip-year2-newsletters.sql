-- ============================================================
-- Migration: Year 2 Newsletter Drip Emails (24 emails, steps 24-47)
-- Run in Supabase SQL Editor AFTER migrate-drip-emails.sql
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
