# Life Therapy — Phase 5b: Legal Documents, Commitment & T&Cs

**Version:** v1
**Depends on:** Phases 1–5 complete (Student model merged, admin client profile, portal onboarding, assessment, commitment acknowledgement flow all live)
**Estimated duration:** 6–8 hours across 4 sub-phases
**Purpose:** Move all legal/policy content from hardcoded files into a versioned, admin-managed database system. Expand commitment text into a proper motivational onboarding letter. Add Terms & Conditions and Privacy Policy as managed documents. Auto-notify clients when documents change. Gate portal on acceptance of latest versions.

---

## What Exists Today (Phase 5 State)

| Item | Location | Status |
|------|----------|--------|
| Commitment text | `lib/commitment.ts` — hardcoded `COMMITMENT_TEXT` object with 5 short sections | ✅ Working but thin, not admin-editable |
| Commitment version | `lib/commitment.ts` — `CURRENT_COMMITMENT_VERSION = "v1"` constant | ✅ Working but requires code deploy to bump |
| CommitmentAcknowledgement | Prisma model, `commitment_acknowledgements` table | ✅ Working, captures IP + user agent |
| Admin commitment tab | `/admin/clients/[id]/tabs/commitment-tab.tsx` — shows audit trail | ✅ Working |
| Portal commitment page | `/portal/commitment/page.tsx` — read-only view | ✅ Working |
| Portal onboarding step 3 | Shows commitment, checkbox + acknowledge button | ✅ Working |
| Terms page | None | ❌ Does not exist |
| Privacy page | None | ❌ Does not exist |
| Admin document editor | None | ❌ Does not exist |

**What changes:** `lib/commitment.ts` is deprecated. All legal content moves to a `legal_documents` table. Admin can edit documents, bump versions, and clients auto-receive notification + re-acknowledgement requirement. Onboarding step 3 becomes "Commitment + T&Cs" (two documents, one step). Public `/terms` and `/privacy` pages render from database.

---

## 5b.1 — Database: Legal Documents System

### New Prisma Models

```prisma
model LegalDocument {
  id             String    @id @default(cuid())
  slug           String    // "commitment" | "terms" | "privacy"
  title          String    // "My Commitment to You" | "Terms & Conditions" | "Privacy Policy"
  content        Json      // Array of { heading: string, content: string } sections
  version        Int       @default(1)
  changeSummary  String?   // "Updated cancellation window from 24h to 48h"
  publishedAt    DateTime?
  isActive       Boolean   @default(false)
  createdBy      String?   // admin user id
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  acceptances    DocumentAcceptance[]

  @@unique([slug, version])
  @@index([slug, isActive])
  @@map("legal_documents")
}

model DocumentAcceptance {
  id             String   @id @default(cuid())
  studentId      String
  student        Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  documentId     String
  document       LegalDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  documentSlug   String   // denormalised for quick queries
  documentVersion Int     // denormalised for quick queries
  ipAddress      String?
  userAgent      String?
  acceptedAt     DateTime @default(now())

  @@unique([studentId, documentSlug, documentVersion])
  @@index([studentId, documentSlug])
  @@map("document_acceptances")
}
```

**Add to Student model:**
```prisma
model Student {
  // ... existing fields ...
  documentAcceptances  DocumentAcceptance[]
  // Keep existing: commitmentAcks CommitmentAcknowledgement[] (don't remove yet — migrate data first)
}
```

### Migration Steps

1. Create `legal_documents` and `document_acceptances` tables
2. Seed initial documents (see Section 5b.2 for full content)
3. Migrate existing `commitment_acknowledgements` data into `document_acceptances`:
```sql
INSERT INTO document_acceptances (id, student_id, document_id, document_slug, document_version, ip_address, user_agent, accepted_at)
SELECT
  ca.id,
  ca.student_id,
  ld.id,
  'commitment',
  1,
  ca.ip_address,
  ca.user_agent,
  ca.acknowledged_at
FROM commitment_acknowledgements ca
CROSS JOIN legal_documents ld
WHERE ld.slug = 'commitment' AND ld.version = 1;
```
4. After migration verified: drop `commitment_acknowledgements` table in a later migration (not same PR — keep as safety net initially)

### Helper Library: `lib/legal-documents.ts`

Replace `lib/commitment.ts` with:

```typescript
// lib/legal-documents.ts

import { prisma } from "@/lib/prisma";

export type LegalDocumentSlug = "commitment" | "terms" | "privacy";

// Which documents require client acceptance (portal gate)
export const REQUIRED_DOCUMENTS: LegalDocumentSlug[] = ["commitment", "terms"];

// Which documents are shown on public pages (no auth required)
export const PUBLIC_DOCUMENTS: LegalDocumentSlug[] = ["terms", "privacy"];

// Which documents are part of onboarding (step 3)
export const ONBOARDING_DOCUMENTS: LegalDocumentSlug[] = ["commitment", "terms"];

/**
 * Get the active version of a legal document by slug.
 */
export async function getActiveDocument(slug: LegalDocumentSlug) {
  return prisma.legalDocument.findFirst({
    where: { slug, isActive: true },
    orderBy: { version: "desc" },
  });
}

/**
 * Get all versions of a document (for admin history view).
 */
export async function getDocumentHistory(slug: LegalDocumentSlug) {
  return prisma.legalDocument.findMany({
    where: { slug },
    orderBy: { version: "desc" },
    include: { _count: { select: { acceptances: true } } },
  });
}

/**
 * Check if a student has accepted the latest version of all required documents.
 * Returns the list of documents that need acceptance.
 */
export async function getOutstandingDocuments(studentId: string): Promise<LegalDocumentSlug[]> {
  const outstanding: LegalDocumentSlug[] = [];

  for (const slug of REQUIRED_DOCUMENTS) {
    const activeDoc = await getActiveDocument(slug);
    if (!activeDoc) continue;

    const acceptance = await prisma.documentAcceptance.findUnique({
      where: {
        studentId_documentSlug_documentVersion: {
          studentId,
          documentSlug: slug,
          documentVersion: activeDoc.version,
        },
      },
    });

    if (!acceptance) outstanding.push(slug);
  }

  return outstanding;
}

/**
 * Record a client's acceptance of a document.
 */
export async function acceptDocument(
  studentId: string,
  slug: LegalDocumentSlug,
  ipAddress: string | null,
  userAgent: string | null
) {
  const activeDoc = await getActiveDocument(slug);
  if (!activeDoc) throw new Error(`No active ${slug} document found`);

  return prisma.documentAcceptance.upsert({
    where: {
      studentId_documentSlug_documentVersion: {
        studentId,
        documentSlug: slug,
        documentVersion: activeDoc.version,
      },
    },
    update: {
      ipAddress,
      userAgent,
      acceptedAt: new Date(),
    },
    create: {
      studentId,
      documentId: activeDoc.id,
      documentSlug: slug,
      documentVersion: activeDoc.version,
      ipAddress,
      userAgent,
    },
  });
}

/**
 * Publish a new version of a document. Deactivates previous version.
 * Returns count of clients who need to re-accept.
 */
export async function publishDocumentVersion(
  slug: LegalDocumentSlug,
  content: { heading: string; content: string }[],
  title: string,
  changeSummary: string,
  createdBy: string
) {
  // Get current active version number
  const current = await getActiveDocument(slug);
  const newVersion = current ? current.version + 1 : 1;

  // Deactivate old
  if (current) {
    await prisma.legalDocument.update({
      where: { id: current.id },
      data: { isActive: false },
    });
  }

  // Create new
  const newDoc = await prisma.legalDocument.create({
    data: {
      slug,
      title,
      content,
      version: newVersion,
      changeSummary,
      publishedAt: new Date(),
      isActive: true,
      createdBy,
    },
  });

  // Count clients who need re-acceptance (active clients only)
  const activeClientCount = await prisma.student.count({
    where: { clientStatus: "active" },
  });

  return { document: newDoc, clientsAffected: activeClientCount };
}

/**
 * Get acceptance stats for a document version.
 */
export async function getAcceptanceStats(slug: LegalDocumentSlug, version: number) {
  const totalActive = await prisma.student.count({
    where: { clientStatus: "active" },
  });

  const accepted = await prisma.documentAcceptance.count({
    where: { documentSlug: slug, documentVersion: version },
  });

  return { total: totalActive, accepted, pending: totalActive - accepted };
}
```

---

## 5b.2 — Document Content: Expanded Commitment + T&Cs + Privacy

### Document 1: "My Commitment to You" (slug: `commitment`)

**This is the warm, personal, motivational onboarding letter from Roxanne. NOT legalese.**

```json
{
  "slug": "commitment",
  "title": "My Commitment to You",
  "version": 1,
  "isActive": true,
  "content": [
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
      "content": "Sessions are 60 minutes via Microsoft Teams. You will receive a Teams meeting link with every booking confirmation. Please join from a quiet, private space where you can speak freely. If you are running late, your session will still end at the scheduled time — I keep strict boundaries to respect every client's time equally. If I am ever unable to have your session, I will let you know at least 24 hours in advance and reschedule at no cost to you. I will only cancel for genuine emergency reasons."
    },
    {
      "heading": "Session Credits & Packages",
      "content": "Session credits are valid for 6 months from the date of purchase. This expiry ensures momentum in your growth journey — consistent sessions deliver the best results. Credits are non-refundable once purchased, but they are transferable between individual and couples session types (where applicable). If you have credits expiring soon, you will receive a reminder so nothing goes to waste."
    },
    {
      "heading": "Rescheduling Policy",
      "content": "Life happens, and I understand that. You may reschedule a session with at least 24 hours' notice at no cost. You can reschedule the same session a maximum of 2 times — after that, please contact me directly. Rescheduling is done through your portal, and you can choose any available slot that works for you."
    },
    {
      "heading": "Cancellation Policy",
      "content": "Cancellations require at least 48 hours' notice. If you cancel with 48+ hours' notice, your session credit is fully refunded to your balance. If you cancel with less than 48 hours' notice, or do not attend your session (no-show), the session credit is forfeited. This policy exists because your time slot is reserved exclusively for you — a late cancellation means that slot cannot be offered to another client who may need it. Genuine emergencies are always handled with compassion — please reach out to me directly if something unexpected happens."
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
  ]
}
```

### Document 2: "Terms & Conditions" (slug: `terms`)

**This is the formal legal document. Clients must accept during onboarding alongside the commitment.**

```json
{
  "slug": "terms",
  "title": "Terms & Conditions",
  "version": 1,
  "isActive": true,
  "content": [
    {
      "heading": "1. Introduction",
      "content": "These Terms & Conditions ('Terms') govern your use of the Life Therapy platform, website (life-therapy.co.za), client portal, and all coaching and counselling services provided by Life Therapy, operated by Roxanne Bouwer ('we', 'us', 'our'). By creating an account, purchasing session credits, or using our services, you agree to be bound by these Terms. If you do not agree, please do not use our services."
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
      "content": "Sessions are booked through the client portal using available credits. Rescheduling requires at least 24 hours' notice and is limited to 2 reschedules per booking. Cancellation with 48+ hours' notice: session credit is refunded to your balance. Cancellation with less than 48 hours' notice: session credit is forfeited. No-show (failure to attend without notice): session credit is forfeited. Anti-abuse policy: if a session is rescheduled from within the 48-hour cancellation window and subsequently cancelled, the original timing applies — the credit is forfeited. Emergency situations are handled at our discretion on a case-by-case basis."
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
  ]
}
```

### Document 3: "Privacy Policy" (slug: `privacy`)

```json
{
  "slug": "privacy",
  "title": "Privacy Policy",
  "version": 1,
  "isActive": true,
  "content": [
    {
      "heading": "1. Introduction",
      "content": "Life Therapy ('we', 'us', 'our'), operated by Roxanne Bouwer, is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website (life-therapy.co.za), client portal, and services. This policy complies with the Protection of Personal Information Act (POPIA), Act No. 4 of 2013."
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
      "heading": "10. Children's Privacy",
      "content": "Our services may involve minors (under 18) only with explicit parental or guardian consent. We do not knowingly collect personal information from children without parental consent."
    },
    {
      "heading": "11. Changes to This Policy",
      "content": "We may update this Privacy Policy from time to time. We will notify registered users of material changes via email. The 'Last updated' date at the top of this policy reflects the most recent revision."
    },
    {
      "heading": "12. Information Regulator",
      "content": "If you are not satisfied with how we handle your personal information, you may lodge a complaint with:\n\nThe Information Regulator (South Africa)\nJD House, 27 Stiemens Street, Braamfontein, Johannesburg, 2001\nEmail: complaints.IR@justice.gov.za"
    },
    {
      "heading": "13. Contact",
      "content": "For questions about this Privacy Policy:\n\nLife Therapy\nUnit 3 Brown House, 13 Station Street, Paarl\nEmail: hello@life-therapy.co.za\nPhone: +27 71 017 0353"
    }
  ]
}
```

---

## 5b.3 — Code Changes

### 3.1 Update Onboarding Step 3

**File:** Portal onboarding wizard, step 3

Currently shows commitment only. Change to show BOTH commitment and terms:

```
Step 3 of 3: Agreement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[●━━━━━━━━━●━━━━━━━━━━●]

┌──────────────────────────────────────┐
│ [My Commitment ▼] [Terms & Conditions ▼]  (two expandable/tab sections)
│                                      │
│ MY COMMITMENT TO YOU                 │
│ (full content from DB, rendered)     │
│                                      │
│ TERMS & CONDITIONS                   │
│ (full content from DB, rendered)     │
│                                      │
│ ☐ I have read and agree to the       │
│   Commitment Agreement and Terms     │
│   & Conditions                       │
│                                      │
│ [← Back]    [I Agree — Let's Start]  │
└──────────────────────────────────────┘
```

**UX notes:**
- Both documents rendered inline (no external links — client must scroll through)
- Single checkbox covers both documents
- Single "I Agree" button creates TWO `DocumentAcceptance` rows (one for `commitment`, one for `terms`)
- Both documents fetched from `legal_documents` table where `isActive = true`

**Server action:** `acceptOnboardingDocuments()`
```typescript
export async function acceptOnboardingDocuments() {
  const { student } = await requireAuth();
  const ip = headers().get("x-forwarded-for") || headers().get("x-real-ip");
  const ua = headers().get("user-agent");

  for (const slug of ONBOARDING_DOCUMENTS) {
    await acceptDocument(student.id, slug, ip, ua);
  }

  // Update onboarding step
  await prisma.student.update({
    where: { id: student.id },
    data: { onboardingStep: 3, profileCompletedAt: new Date() },
  });
}
```

### 3.2 Portal Gate: Check All Required Documents

**File:** Portal layout or middleware

Currently checks `CURRENT_COMMITMENT_VERSION` constant. Replace with:

```typescript
// In portal layout.tsx or a shared auth wrapper
const outstanding = await getOutstandingDocuments(student.id);

if (outstanding.length > 0 && !isOnboardingRoute) {
  // Redirect to re-acceptance flow
  redirect("/portal/review-documents");
}
```

**New page:** `/portal/review-documents/page.tsx`
- Shows each outstanding document with full content
- "I have read and accept the updated [document title]" checkbox per document
- "Continue" button — creates acceptance rows
- After all accepted → redirect to portal dashboard
- This page is accessible even when gate is active (obviously)

### 3.3 Public Legal Pages

**New routes:**
- `app/(public)/terms/page.tsx`
- `app/(public)/privacy/page.tsx`

Both fetch from `legal_documents` table:

```typescript
// app/(public)/terms/page.tsx
export default async function TermsPage() {
  const doc = await prisma.legalDocument.findFirst({
    where: { slug: "terms", isActive: true },
  });

  if (!doc) notFound();

  const sections = doc.content as { heading: string; content: string }[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Version {doc.version} · Last updated: {format(doc.publishedAt, "MMMM yyyy")}
      </p>
      <div className="mt-10 space-y-8">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold">{section.heading}</h2>
            <p className="mt-2 text-muted-foreground whitespace-pre-line">{section.content}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
```

Same pattern for `/privacy/page.tsx` with `slug: "privacy"`.

### 3.4 Admin: Legal Documents Settings Page

**New route:** `app/(admin)/admin/(dashboard)/settings/legal-documents/page.tsx`

```
Settings → Legal Documents
┌─────────────────────────────────────────────────┐
│ My Commitment to You          v1  ● Active      │
│ Last updated: Feb 2026                          │
│ Accepted by: 12/14 clients (2 pending)          │
│ [Edit] [View History]                           │
├─────────────────────────────────────────────────┤
│ Terms & Conditions            v1  ● Active      │
│ Last updated: Feb 2026                          │
│ Accepted by: 14/14 clients                      │
│ [Edit] [View History]                           │
├─────────────────────────────────────────────────┤
│ Privacy Policy                v1  ● Active      │
│ Last updated: Feb 2026                          │
│ Not client-accepted (public page only)          │
│ [Edit] [View History]                           │
└─────────────────────────────────────────────────┘
```

**Edit dialog/page:** Opens with current sections. Each section has heading + content textarea. Can add/remove/reorder sections. "Change summary" field (required). "Publish New Version" button.

**On publish:**
1. Call `publishDocumentVersion()`
2. For `commitment` and `terms`: send email to all active clients who haven't accepted
3. Show confirmation: "Version 2 published. 14 clients will be notified."

**Email template:** `legal_document_updated`
```
Subject: Updated [document title] — Please Review

Hi [firstName],

We've updated our [document title]. Here's a summary of what changed:

"[changeSummary]"

Please log in to your portal to review and accept the updated agreement:

[Review Now →]

This is required to continue booking sessions.

Roxanne
Life Therapy
```

**View History:** Shows all versions with accepted count, change summary, date. Can click to view full content of any version.

### 3.5 Update Admin Client Commitment Tab

**File:** `app/(admin)/admin/(dashboard)/clients/[id]/tabs/commitment-tab.tsx`

Replace current implementation that reads from `lib/commitment.ts` with DB-driven version:

- Show acceptance status for each required document (commitment + terms)
- Audit trail from `document_acceptances` table (not old `commitment_acknowledgements`)
- "Require Re-Acknowledgement" button now actually works: opens dialog asking for change summary → publishes new version with same content → triggers notification flow
- "View Document" button shows content from DB

### 3.6 Deprecate `lib/commitment.ts`

After migration is verified:
1. Remove `CURRENT_COMMITMENT_VERSION` and `COMMITMENT_TEXT` exports
2. Update all imports to use `lib/legal-documents.ts`
3. Remove `CommitmentAcknowledgement` model from Prisma schema (after data migration confirmed)
4. Keep old table for 1 release cycle as safety net, then drop

### 3.7 Add Settings Sidebar Link

Add "Legal Documents" under Settings in admin sidebar, linking to `/admin/settings/legal-documents`.

---

## 5b.4 — Implementation Checklist

### Sub-phase A: Database & Library (2 hours)
- [ ] Create Prisma models: `LegalDocument`, `DocumentAcceptance`
- [ ] Add `documentAcceptances` relation to `Student`
- [ ] Run migration
- [ ] Create `lib/legal-documents.ts` with all helper functions
- [ ] Create seed file with all 3 documents (commitment, terms, privacy) from Section 5b.2
- [ ] Run seed
- [ ] Migrate existing `commitment_acknowledgements` data → `document_acceptances`
- [ ] Verify migration with test query

### Sub-phase B: Portal Changes (2 hours)
- [ ] Update onboarding step 3: fetch both documents from DB, render inline, single checkbox + button creates 2 acceptances
- [ ] Create `/portal/review-documents` page for re-acceptance on version bump
- [ ] Update portal gate/layout: replace `CURRENT_COMMITMENT_VERSION` check with `getOutstandingDocuments()`
- [ ] Update portal commitment page: read from DB instead of `lib/commitment.ts`
- [ ] Server actions: `acceptOnboardingDocuments()`, `acceptUpdatedDocuments()`

### Sub-phase C: Public Pages & Admin (2-3 hours)
- [ ] Create `app/(public)/terms/page.tsx` — renders from DB
- [ ] Create `app/(public)/privacy/page.tsx` — renders from DB
- [ ] Add SEO metadata to both pages
- [ ] Add footer links to terms and privacy pages
- [ ] Create `app/(admin)/admin/(dashboard)/settings/legal-documents/page.tsx`
- [ ] Admin document list with acceptance stats
- [ ] Admin edit dialog: section editor + change summary + publish
- [ ] Admin view history: version list with accepted counts
- [ ] Admin sidebar: add "Legal Documents" under Settings

### Sub-phase D: Notifications & Cleanup (1-2 hours)
- [ ] Email template: `legal_document_updated` (React Email)
- [ ] On publish new version: send notification to active clients missing acceptance
- [ ] Update admin client commitment tab: read from `document_acceptances`, show both documents
- [ ] "Require Re-Acknowledgement" button: functional (publish new version with same content)
- [ ] Deprecate `lib/commitment.ts` (remove exports, update all imports)
- [ ] Add TODO comment on `CommitmentAcknowledgement` model: "Remove after confirming migration — keep 1 release"
- [ ] Test: full onboarding flow (new client sees commitment + terms in step 3)
- [ ] Test: version bump flow (admin publishes v2 → client sees gate on next login → accepts → gate lifts)
- [ ] Test: public pages render from DB
- [ ] Test: migrated client data appears correctly in new system

---

## Test Scenarios

| # | Scenario | Expected |
|---|----------|----------|
| 1 | New client completes onboarding step 3 | Two `document_acceptances` rows created (commitment + terms) |
| 2 | Client visits `/portal/commitment` | Shows commitment content from DB, accepted date |
| 3 | Admin publishes commitment v2 with change summary | Old version deactivated, new version active, email sent to all active clients |
| 4 | Client logs into portal after v2 published | Redirected to `/portal/review-documents`, must accept before accessing portal |
| 5 | Client accepts updated documents | New acceptance rows, redirect to dashboard, gate lifts |
| 6 | Public `/terms` page | Renders from DB, shows version + date |
| 7 | Public `/privacy` page | Renders from DB, shows version + date |
| 8 | Admin views client commitment tab | Shows acceptance history from `document_acceptances` for both documents |
| 9 | Admin clicks "Require Re-Acknowledgement" | Dialog → change summary → publishes new version → notification sent |
| 10 | Migrated client first login | Old commitment acknowledgement visible in history, current version check works |
| 11 | Admin edits terms, adds new section | New version created, clients notified, portal gated until accepted |
| 12 | Privacy policy updated | No portal gate (not in `REQUIRED_DOCUMENTS`), public page shows new content |

---

## File Summary

| Action | File |
|--------|------|
| CREATE | `prisma/migrations/XXX_legal_documents.sql` |
| CREATE | `prisma/seed-legal-documents.ts` (or add to existing seed) |
| CREATE | `lib/legal-documents.ts` |
| CREATE | `app/(public)/terms/page.tsx` |
| CREATE | `app/(public)/privacy/page.tsx` |
| CREATE | `app/(portal)/portal/(dashboard)/review-documents/page.tsx` |
| CREATE | `app/(admin)/admin/(dashboard)/settings/legal-documents/page.tsx` |
| CREATE | `components/email/legal-document-updated.tsx` |
| MODIFY | Portal onboarding step 3 component (fetch from DB, dual document, dual acceptance) |
| MODIFY | Portal layout/gate (use `getOutstandingDocuments()` instead of version constant) |
| MODIFY | `app/(portal)/portal/(dashboard)/commitment/page.tsx` (read from DB) |
| MODIFY | `app/(admin)/admin/(dashboard)/clients/[id]/tabs/commitment-tab.tsx` (read from `document_acceptances`) |
| MODIFY | Admin sidebar (add Legal Documents link under Settings) |
| MODIFY | Footer component (add Terms & Privacy links) |
| DEPRECATE | `lib/commitment.ts` (remove after migration verified) |
| DEPRECATE (later) | `CommitmentAcknowledgement` model + table (keep 1 release, then drop) |