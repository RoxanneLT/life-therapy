-- Seed the three legal documents: Commitment, Terms & Conditions, Privacy Policy
-- Idempotent: uses ON CONFLICT ("slug", "version") DO NOTHING

INSERT INTO "legal_documents" (
  "id",
  "slug",
  "title",
  "content",
  "version",
  "isActive",
  "publishedAt",
  "createdAt",
  "updatedAt"
)
VALUES
-- ────────────────────────────────────────────────────────────
-- 1. My Commitment to You
-- ────────────────────────────────────────────────────────────
(
  gen_random_uuid()::text,
  'commitment',
  'My Commitment to You',
  '[
    {
      "heading": "Welcome to Life Therapy",
      "content": "Thank you for trusting me with your journey. Taking this step takes courage, and I want you to know — you are in a safe space. Everything we do together is designed around one goal: helping you become the best version of yourself. This commitment is my promise to you, and yours to yourself."
    },
    {
      "heading": "My Promise to You",
      "content": "I will be ready, prepared, and fully present for every session at the agreed time. During your session, I will devote 100% of my energy to helping you achieve your goals, overcome your concerns, and grow into the person you want to be. I will never judge you — your thoughts, feelings, and experiences are valid, and this is your safe space to explore them. I commit to my own ongoing professional development so that I can always bring my best to our work together."
    },
    {
      "heading": "How Sessions Work",
      "content": "Sessions are 60 minutes via Microsoft Teams. You will receive a Teams meeting link with every booking confirmation. Please join from a quiet, private space where you can speak freely. If you are running late, your session will still end at the scheduled time — I keep strict boundaries to respect every client''s time equally. If I am ever unable to have your session, I will let you know at least 24 hours in advance and reschedule at no cost to you. I will only cancel for genuine emergency reasons."
    },
    {
      "heading": "Session Credits & Packages",
      "content": "Session credits are valid for 6 months from the date of purchase. This expiry ensures momentum in your growth journey — consistent sessions deliver the best results. Credits are non-refundable once purchased, but they are transferable between individual and couples session types (where applicable). If you have credits expiring soon, you will receive a reminder so nothing goes to waste."
    },
    {
      "heading": "Rescheduling Policy",
      "content": "Life happens, and I understand that. You may reschedule a session with at least 24 hours'' notice at no cost. You can reschedule the same session a maximum of 2 times — after that, please contact me directly. Rescheduling is done through your portal, and you can choose any available slot that works for you."
    },
    {
      "heading": "Cancellation Policy",
      "content": "Cancellations require at least 48 hours'' notice. If you cancel with 48+ hours'' notice, your session credit is fully refunded to your balance. If you cancel with less than 48 hours'' notice, or do not attend your session (no-show), the session credit is forfeited. This policy exists because your time slot is reserved exclusively for you — a late cancellation means that slot cannot be offered to another client who may need it. Genuine emergencies are always handled with compassion — please reach out to me directly if something unexpected happens."
    },
    {
      "heading": "Confidentiality",
      "content": "Everything shared during our sessions — your words, feelings, thoughts, and experiences — is 100% confidential. I take your privacy seriously and will never share your information with anyone without your explicit written consent. The only exception is where I am legally required to act if there is an immediate risk of harm to yourself or others. If you need to contact me between sessions, please feel free to do so. Depending on the duration and frequency of between-session contact, this may be at an additional charge, which I will always communicate upfront."
    },
    {
      "heading": "Your Commitment",
      "content": "I ask that you commit to showing up — not just to your sessions, but to your own growth. Be honest with me and with yourself. Complete any exercises or reflections I suggest between sessions. Invest in yourself for at least the number of sessions in your purchased package. By acknowledging this agreement, you confirm that the personal information you have provided is true and correct, and that you understand and accept the session, rescheduling, and cancellation policies above."
    },
    {
      "heading": "Between Sessions",
      "content": "Growth does not only happen in our 60 minutes together. I may suggest journaling exercises, reflection prompts, or small daily practices between sessions. These are not homework — they are tools to help you carry the progress we make together into your everyday life. Your portal keeps track of your journey, your credits, and your upcoming sessions so you always know where you stand."
    },
    {
      "heading": "A Final Note",
      "content": "I believe in you. The fact that you are here means you are ready for change. I am honoured to walk this path with you.\n\nWith warmth,\nRoxanne Bouwer\nAccredited Coach Dip LC (Inst BCLC) & Counsellor of Psychology"
    }
  ]'::jsonb,
  1,
  true,
  NOW(),
  NOW(),
  NOW()
),

-- ────────────────────────────────────────────────────────────
-- 2. Terms & Conditions
-- ────────────────────────────────────────────────────────────
(
  gen_random_uuid()::text,
  'terms',
  'Terms & Conditions',
  '[
    {
      "heading": "1. Introduction",
      "content": "These Terms & Conditions (''Terms'') govern your use of the Life Therapy platform, website (life-therapy.co.za), client portal, and all coaching and counselling services provided by Life Therapy, operated by Roxanne Bouwer (''we'', ''us'', ''our''). By creating an account, purchasing session credits, or using our services, you agree to be bound by these Terms. If you do not agree, please do not use our services."
    },
    {
      "heading": "2. Services Provided",
      "content": "Life Therapy provides individual and couples life coaching and counselling sessions, online courses, digital products, and session credit packages. Sessions are conducted via Microsoft Teams unless otherwise agreed. Services are provided by Roxanne Bouwer, Accredited Coach Dip LC (Inst BCLC) & Counsellor of Psychology. Life Therapy is a coaching and counselling service — it is not a substitute for medical treatment, psychiatric care, or emergency services. If you are in crisis, please contact SADAG on 0800 567 567 or your nearest emergency service."
    },
    {
      "heading": "3. Accounts & Portal Access",
      "content": "When an account is created for you, you will receive a temporary password which must be changed on first login. You are responsible for keeping your login credentials secure and for all activity under your account. You must provide accurate and complete personal information. Notify us immediately of any unauthorised access to your account."
    },
    {
      "heading": "4. Session Credits & Pricing",
      "content": "Session credits are purchased in packages at the prices displayed on our website. All prices are in South African Rand (ZAR) and include VAT where applicable. Credits are valid for 6 months from date of purchase. Expired credits are forfeited and non-refundable. We reserve the right to adjust pricing at any time, but changes will not affect credits already purchased. Credit balances are visible in your portal at all times."
    },
    {
      "heading": "5. Booking, Rescheduling & Cancellation Policy",
      "content": "Sessions are booked through the client portal using available credits. Rescheduling requires at least 24 hours'' notice and is limited to 2 reschedules per booking. Cancellation with 48+ hours'' notice: session credit is refunded to your balance. Cancellation with less than 48 hours'' notice: session credit is forfeited. No-show (failure to attend without notice): session credit is forfeited. Anti-abuse policy: if a session is rescheduled from within the 48-hour cancellation window and subsequently cancelled, the original timing applies — the credit is forfeited. Emergency situations are handled at our discretion on a case-by-case basis."
    },
    {
      "heading": "6. Payments & Refunds",
      "content": "Payments are processed securely via Paystack. We do not store your card details. Session credit packages are non-refundable once purchased, except where required by the Consumer Protection Act 68 of 2008. Course and digital product purchases are non-refundable once access has been granted. If you believe you have been incorrectly charged, contact us within 7 days of the transaction."
    },
    {
      "heading": "7. Confidentiality",
      "content": "All information shared during coaching and counselling sessions is treated as strictly confidential. We will not disclose your information to any third party without your explicit written consent, except where: (a) we are required to do so by law; (b) there is an immediate and serious risk of harm to you or others; (c) a court order compels disclosure. Session notes, if kept, are stored securely and are accessible only to your practitioner."
    },
    {
      "heading": "8. Your Responsibilities",
      "content": "You agree to: provide accurate personal information; attend scheduled sessions or cancel/reschedule within the required notice periods; treat our staff and systems with respect; not record sessions without prior written consent; not share your portal login with others; not use our services for any unlawful purpose."
    },
    {
      "heading": "9. Intellectual Property",
      "content": "All content on the Life Therapy website, portal, courses, and digital products — including text, images, videos, branding, and course materials — is the intellectual property of Life Therapy and may not be copied, reproduced, distributed, or shared without prior written consent. Course materials and digital products are licensed for your personal use only."
    },
    {
      "heading": "10. Online Courses & Digital Products",
      "content": "Access to courses and digital products is granted upon purchase and is for the registered account holder only. Course progress is tracked in your portal. We reserve the right to update course content at any time. Sharing, reselling, or redistributing course materials is prohibited."
    },
    {
      "heading": "11. Gift Vouchers & Promotional Credits",
      "content": "Gift vouchers are valid for the period stated at time of purchase. Gifted credits are non-refundable and non-transferable for cash. Promotional or complimentary credits may be subject to additional conditions as communicated at the time of issue."
    },
    {
      "heading": "12. Limitation of Liability",
      "content": "To the maximum extent permitted by South African law, Life Therapy shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services. Our total liability for any claim shall not exceed the amount you paid in the 6 months preceding the claim. Life Therapy is not responsible for technical issues with Microsoft Teams, internet connectivity, or third-party services beyond our control."
    },
    {
      "heading": "13. Dispute Resolution",
      "content": "If you have a complaint or dispute, please contact us first at hello@life-therapy.co.za. We will endeavour to resolve any issue within 14 business days. If we cannot resolve the matter informally, the dispute shall be referred to mediation before any legal proceedings. These Terms are governed by the laws of the Republic of South Africa, and any legal proceedings shall be subject to the jurisdiction of the Western Cape High Court."
    },
    {
      "heading": "14. Force Majeure",
      "content": "Life Therapy shall not be liable for any failure or delay in performing our obligations due to circumstances beyond our reasonable control, including but not limited to: load shedding, internet service interruptions, natural disasters, pandemic restrictions, or government-imposed regulations."
    },
    {
      "heading": "15. Changes to These Terms",
      "content": "We may update these Terms from time to time. When we do, you will be notified via email and will be required to review and accept the updated Terms before continuing to use the portal and booking services. Your continued use of our services after accepting updated Terms constitutes agreement to the changes."
    },
    {
      "heading": "16. Termination",
      "content": "We reserve the right to suspend or terminate your account if you: breach these Terms; engage in abusive, threatening, or harmful behaviour; repeatedly no-show without communication; attempt to circumvent our booking policies. Any unused credits at the time of termination due to a breach of Terms are forfeited."
    },
    {
      "heading": "17. Contact",
      "content": "For any questions about these Terms, please contact us:\n\nLife Therapy\nUnit 3 Brown House, 13 Station Street, Paarl\nEmail: hello@life-therapy.co.za\nPhone: +27 71 017 0353\nWebsite: www.life-therapy.co.za"
    }
  ]'::jsonb,
  1,
  true,
  NOW(),
  NOW(),
  NOW()
),

-- ────────────────────────────────────────────────────────────
-- 3. Privacy Policy
-- ────────────────────────────────────────────────────────────
(
  gen_random_uuid()::text,
  'privacy',
  'Privacy Policy',
  '[
    {
      "heading": "1. Introduction",
      "content": "Life Therapy (''we'', ''us'', ''our''), operated by Roxanne Bouwer, is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website (life-therapy.co.za), client portal, and services. This policy complies with the Protection of Personal Information Act (POPIA), Act No. 4 of 2013."
    },
    {
      "heading": "2. Information We Collect",
      "content": "Information you provide: name, date of birth, gender, email, phone, address, emergency contact, relationship status, referral source, assessment responses (behaviours, feelings, physical symptoms you identify with), session notes and communications, payment information (processed by Paystack — we do not store card details). Information collected automatically: pages visited, session booking activity, device and browser information, IP address (captured during document acceptance for audit purposes)."
    },
    {
      "heading": "3. How We Use Your Information",
      "content": "We use your information to: provide and manage coaching and counselling services; process payments and manage session credits; send booking confirmations, reminders, and session-related communications; improve our services and your experience; send newsletters and marketing communications (only with your consent); comply with legal obligations; maintain audit trails for document acceptance and policy compliance."
    },
    {
      "heading": "4. Sensitive Information",
      "content": "Your assessment data (behaviours, feelings, physical symptoms) and session content are classified as special personal information under POPIA. This data is: collected with your explicit consent during onboarding; used solely for the purpose of providing coaching and counselling services; accessible only to your practitioner (Roxanne Bouwer); never shared with third parties; stored securely with encryption at rest."
    },
    {
      "heading": "5. Information Sharing",
      "content": "We do not sell your personal information. We may share limited information with: Paystack (payment processing); Supabase (secure database hosting); Vercel (website hosting); Resend (email delivery); Microsoft Teams (session delivery). All third-party providers are contractually required to protect your data and use it only for the purposes we specify."
    },
    {
      "heading": "6. Data Retention",
      "content": "We retain your personal information for as long as your account is active or as needed to provide services. Session-related records are retained for 5 years after your last session (in line with professional practice guidelines). Financial records are retained for 5 years (SARS requirements). You may request deletion of your account and personal data at any time, subject to legal retention requirements."
    },
    {
      "heading": "7. Data Security",
      "content": "We protect your information through: SSL/TLS encryption on all data in transit; Row-Level Security (RLS) policies ensuring you can only access your own data; secure authentication with password hashing; role-based access control (your data is only visible to you and your practitioner); regular security updates. While we implement industry-standard security measures, no method of electronic transmission or storage is 100% secure."
    },
    {
      "heading": "8. Your Rights Under POPIA",
      "content": "You have the right to: access a copy of your personal information; request correction of inaccurate information; request deletion of your personal information (subject to legal retention); object to processing for direct marketing; withdraw consent for marketing at any time; receive your data in a portable format; lodge a complaint with the Information Regulator. To exercise these rights, contact us at hello@life-therapy.co.za. We will respond within 30 days."
    },
    {
      "heading": "9. Cookies & Tracking",
      "content": "We use minimal cookies: authentication cookies (essential for login); theme and language preferences (stored locally). We do not use third-party advertising or analytics cookies. If this changes, we will update this policy and request your consent."
    },
    {
      "heading": "10. Children''s Privacy",
      "content": "Our services may involve minors (under 18) only with explicit parental or guardian consent. We do not knowingly collect personal information from children without parental consent."
    },
    {
      "heading": "11. Changes to This Policy",
      "content": "We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. The ''Last updated'' date at the top of this policy reflects the most recent revision."
    },
    {
      "heading": "12. Information Regulator",
      "content": "If you are not satisfied with how we handle your personal information, you may lodge a complaint with:\n\nThe Information Regulator (South Africa)\nJD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001\nEmail: complaints.IR@justice.gov.za"
    },
    {
      "heading": "13. Contact",
      "content": "For questions about this Privacy Policy:\n\nLife Therapy\nUnit 3 Brown House, 13 Station Street, Paarl\nEmail: hello@life-therapy.co.za\nPhone: +27 71 017 0353"
    }
  ]'::jsonb,
  1,
  true,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT ("slug", "version") DO NOTHING;
