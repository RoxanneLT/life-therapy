# Life Therapy — Digital Onboarding, Unified Client Model & Portal

**Version:** v3-final (replaces ALL previous onboarding briefs)

**Summary:** Contact and Student merge into one unified Client model (Student table). Single "Clients" admin page with filter tabs. Client profile has 8 tabs including Communications. Portal gives clients self-service booking management with policy-enforced cancel/reschedule. Digital intake form replaces paper form. Commitment letter with audit trail.

---

## The Client Journey

```
STRANGER                    POTENTIAL CLIENT              ACTIVE CLIENT
────────                    ────────────────              ─────────────
Books free consultation     During/after consultation     Ongoing sessions
→ Gets booking confirmation → Roxanne "converts"          → Books from portal
→ Gets temp login           → Intake pre-filled by Rox    → Reschedule/cancel
→ Can see their booking     → Client reviews/completes    → Credits managed
  in portal                 → Commitment acknowledged     → Assessment updated
```

### Detailed Flow

1. **Client books free consultation** on website
   - System creates booking + Student record (status: "potential")
   - System creates Supabase auth user with temp password
   - System creates empty ClientIntake record
   - Client receives: booking confirmation email + "Your portal is ready" email with temp password
   - Client logs in → sees scheduled consultation + personal details (name/email/phone pre-filled from booking)

2. **Free consultation happens** (30 min)
   - Last 10-15 minutes: Roxanne opens admin, clicks "Convert to Client"
   - Selects package / grants credits
   - Can pre-fill intake assessment live (ticking behaviours/feelings/symptoms as client mentions them)
   - Client's status changes from "potential" → "active"

3. **After consultation** — client completes onboarding in portal
   - Portal shows 3-step onboarding (progress bar at top):
     - **Step 1: Personal Details** — review/complete profile (some pre-filled)
     - **Step 2: Assessment** — review/complete what Roxanne pre-filled, add more
     - **Step 3: Commitment** — read & acknowledge the agreement
   - Steps 1 & 2 are saveable at any time (not all-or-nothing)
   - Step 3 is required before booking first paid session

4. **Ongoing** — client uses portal self-service:
   - View upcoming & past sessions
   - Book new sessions (using credits)
   - Reschedule (24hr notice) / Cancel (48hr notice)
   - Update their assessment over time
   - View credit balance, purchase history, commitment

### Existing Client Migration

- Roxanne imports existing clients (bulk or one-by-one)
- Each gets a "Welcome to our new portal" email with temp password
- On first login: set password → see ONLY Step 3 (updated commitment/cancellation policy)
- Steps 1 & 2 available in profile but not required (Rox already has their info on paper)
- Their existing scheduled sessions appear in the portal

---

## 1. Data Model: The Merge

### 1.1 Why Merge

Life Therapy currently has three overlapping entities representing the same person:

| Entity | Where | Created when |
|--------|-------|-------------|
| **Contact** | `contacts` table, admin "Contacts" page | Newsletter signup, booking, import, manual entry |
| **Student** | `students` table, admin "Students" page | Portal account creation |
| **Booking guest** | Name/email/phone on `bookings` table | Any booking |

Roxanne's existing/imported clients live in Contacts. When someone gets a portal account they become a Student. This creates confusion — where does Roxanne go to see "her clients"?

**Solution:** Student IS the client. Contact table is absorbed into Student. Single "Clients" page in admin.

### 1.2 What Happens to Contact

The `Contact` model currently holds:
- Basic info (email, firstName, lastName, phone, gender)
- Marketing fields (source, tags, consentGiven, consentDate, consentMethod)
- Email prefs (emailOptOut, emailPaused, emailPausedAt, emailPauseReason)
- Unsubscribe token
- Drip progress (relation)
- Campaign progress (relation)
- Client lifecycle (clientStatus, convertedAt, convertedBy)
- Notes

**All of this moves to Student.** The Contact table is deprecated. Existing Contact data is migrated to Student records via SQL migration.

### 1.3 Student Model — The Unified Client

```prisma
model Student {
  // ── Identity (existing) ──
  id                 String    @id @default(cuid())
  supabaseUserId     String    @unique
  email              String    @unique
  firstName          String
  lastName           String
  avatarUrl          String?
  mustChangePassword Boolean   @default(false)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  // ── Extended Profile (existing from previous migration) ──
  dateOfBirth        DateTime?  @db.Date
  gender             String?
  phone              String?
  address            String?    @db.Text
  relationshipStatus String?
  emergencyContact   String?
  referralSource     String?
  referralDetail     String?

  // ── Client Lifecycle (NEW — from Contact) ──
  clientStatus       String     @default("potential") // "potential" | "active" | "inactive" | "archived"
  convertedAt        DateTime?
  convertedBy        String?

  // ── Source & Tags (NEW — from Contact) ──
  source             String     @default("booking") // "newsletter" | "booking" | "import" | "manual" | "website"
  tags               Json?

  // ── Communication Preferences (NEW — merged from Contact + existing emailOptOut) ──
  emailOptOut        Boolean    @default(false)  // exists already
  emailPaused        Boolean    @default(false)
  emailPausedAt      DateTime?
  emailPauseReason   String?
  newsletterOptIn    Boolean    @default(true)
  marketingOptIn     Boolean    @default(true)
  smsOptIn           Boolean    @default(false)
  sessionReminders   Boolean    @default(true)
  consentGiven       Boolean    @default(false)
  consentDate        DateTime?
  consentMethod      String?    // "booking_form" | "newsletter_signup" | "import" | "manual"
  unsubscribeToken   String?    @unique @default(cuid())  // exists already

  // ── Onboarding (existing from previous migration) ──
  onboardingStep     Int        @default(0)
  profileCompletedAt DateTime?

  // ── Admin Notes ──
  adminNotes         String?    @db.Text

  // ── All existing relations stay ──
  enrollments            Enrollment[]
  moduleAccess           ModuleAccess[]
  digitalProductAccess   DigitalProductAccess[]
  lectureProgress        LectureProgress[]
  quizAttempts           QuizAttempt[]
  certificates           Certificate[]
  orders                 Order[]
  creditBalance          SessionCreditBalance?
  creditTransactions     SessionCreditTransaction[]
  cart                   Cart?
  notes                  StudentNote[]
  giftsGiven             Gift[]   @relation("GiftBuyer")
  giftsReceived          Gift[]   @relation("GiftRecipient")
  emailLogs              EmailLog[]
  intake                 ClientIntake?
  commitmentAcks         CommitmentAcknowledgement[]
  bookings               Booking[]

  // ── NEW: Marketing relations (moved from Contact) ──
  dripProgress           DripProgress?
  campaignProgress       CampaignProgress[]

  @@index([clientStatus])
  @@index([source])
  @@index([emailOptOut])
  @@map("students")
}
```

### 1.4 ClientIntake (Assessment)

```prisma
model ClientIntake {
  id              String    @id @default(cuid())
  studentId       String    @unique
  student         Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)

  behaviours      String[]  @default([])
  feelings        String[]  @default([])
  symptoms        String[]  @default([])

  otherBehaviours String?
  otherFeelings   String?
  otherSymptoms   String?
  additionalNotes String?   @db.Text
  adminNotes      String?   @db.Text  // Admin-only, NOT visible to client

  lastEditedBy    String?   // "client" | "admin"
  lastEditedAt    DateTime  @default(now())
  completedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@map("client_intakes")
}
```

**Predefined option lists** (stored in code as constants, single source of truth for admin + portal):

Behaviours:
```
eating_problems, suicidal_attempts, self_sabotage, addictive_problems, 
compulsions, insomnia, low_self_esteem, negative_body_image, 
lack_of_motivation, odd_behaviour, isolation, anxiety_stress, crying, 
procrastination, impulsive_reactions, hard_to_function, emotional_outbursts, 
aggressive_behaviour, toxic_relationships, concentration_difficulties, 
phobic, negative_thoughts, overwhelming_fears, identity_confusion, avoidance
```

Feelings:
```
sadness, doubt, anger, guilt, annoyed, happy, bored, conflicted, confused, 
depressed, regretful, lonely, hopeless, frustrated, stuck, content, excited, 
tense, jealous, relaxed, energetic, optimistic
```

Physical symptoms:
```
headaches, stomach_problems, skin_problems, dizziness, dry_mouth, 
heart_palpitations, fatigue, muscle_spasms, nervous_twitches, chest_pains, 
tension, back_pain, unable_to_relax, fainting_spells, blackouts, 
hearing_things, sweating, tingling, crying_physical, scratching, 
visual_disturbances, numbness
```

### 1.5 CommitmentAcknowledgement (with Audit Trail)

```prisma
model CommitmentAcknowledgement {
  id             String   @id @default(cuid())
  studentId      String
  student        Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  version        String   @default("v1")
  ipAddress      String?
  userAgent      String?
  acknowledgedAt DateTime @default(now())

  @@unique([studentId, version])
  @@map("commitment_acknowledgements")
}
```

Every version acknowledgement is a separate row. When commitment text changes (v1 → v2), existing clients must re-acknowledge. Admin sees full history.

**Version management:** `CURRENT_COMMITMENT_VERSION` constant in `lib/commitment.ts`. Bump when commitment text changes. Clients without current version get redirected.

### 1.6 Booking Model — Anti-Abuse Tracking

Ensure these fields exist:

```prisma
model Booking {
  // ... existing fields ...

  studentId              String?
  student                Student?  @relation(fields: [studentId], references: [id], onDelete: SetNull)

  originalDate           DateTime? @db.Date
  originalStartTime      String?
  rescheduledAt          DateTime?
  rescheduleCount        Int       @default(0)
  
  cancelledAt            DateTime?
  cancelledBy            String?   // "client" | "admin"
  cancellationReason     String?
  creditRefunded         Boolean   @default(false)
  isLateCancel           Boolean   @default(false)
}
```

### 1.7 DripProgress & CampaignProgress — Relink to Student

```prisma
model DripProgress {
  id           String        @id @default(cuid())
  studentId    String        @unique        // was contactId
  student      Student       @relation(...)  // was contact
  currentPhase DripEmailType @default(onboarding)
  currentStep  Int           @default(0)
  lastSentAt   DateTime?
  completedAt  DateTime?
  isPaused     Boolean       @default(false)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
}

model CampaignProgress {
  id          String    @id @default(cuid())
  campaignId  String
  campaign    Campaign  @relation(...)
  studentId   String                        // was contactId
  student     Student   @relation(...)      // was contact
  currentStep Int       @default(0)
  lastSentAt  DateTime?
  completedAt DateTime?
  isPaused    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([campaignId, studentId])
}
```

### 1.8 Contact Table — Migration & Deprecation

```sql
-- 1. For Contacts WITH a linked Student: merge marketing fields
UPDATE students s
SET 
  source = c.source::text,
  tags = c.tags,
  consent_given = c.consent_given,
  consent_date = c.consent_date,
  consent_method = c.consent_method,
  email_opt_out = c.email_opt_out,
  email_paused = c.email_paused,
  email_paused_at = c.email_paused_at,
  email_pause_reason = c.email_pause_reason,
  client_status = COALESCE(c.client_status, 'active'),
  admin_notes = c.notes
FROM contacts c
WHERE c.student_id = s.id;

-- 2. For Contacts WITHOUT a Student (newsletter-only, old imports):
INSERT INTO students (
  id, supabase_user_id, email, first_name, last_name, phone, gender,
  source, tags, consent_given, consent_date, consent_method,
  email_opt_out, email_paused, unsubscribe_token, client_status, admin_notes,
  created_at, updated_at
)
SELECT 
  c.id, 'pending_' || c.id, c.email, 
  COALESCE(c.first_name, ''), COALESCE(c.last_name, ''),
  c.phone, c.gender, c.source::text, c.tags,
  c.consent_given, c.consent_date, c.consent_method,
  c.email_opt_out, c.email_paused, c.unsubscribe_token,
  COALESCE(c.client_status, 'active'), c.notes,
  c.created_at, now()
FROM contacts c
WHERE c.student_id IS NULL;

-- 3. Relink DripProgress
ALTER TABLE drip_progress RENAME COLUMN contact_id TO student_id;
ALTER TABLE drip_progress DROP CONSTRAINT drip_progress_contact_id_fkey;
ALTER TABLE drip_progress ADD CONSTRAINT drip_progress_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- 4. Relink CampaignProgress
ALTER TABLE campaign_progress RENAME COLUMN contact_id TO student_id;
ALTER TABLE campaign_progress DROP CONSTRAINT campaign_progress_contact_id_fkey;
ALTER TABLE campaign_progress ADD CONSTRAINT campaign_progress_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE campaign_progress DROP CONSTRAINT campaign_progress_campaign_id_contact_id_key;
ALTER TABLE campaign_progress ADD CONSTRAINT campaign_progress_campaign_id_student_id_key 
  UNIQUE (campaign_id, student_id);

-- 5. Backfill bookings
UPDATE bookings SET original_date = date, original_start_time = start_time 
WHERE original_date IS NULL;
```

---

## 2. Admin Sidebar

```
Dashboard
Clients                    ← single link to /admin/clients
Bookings
Communication
├── Campaigns
├── Drip Sequences
└── Email Templates
Learning
├── Courses
├── Digital Products
├── Packages
├── Certificates
├── Gifts
├── Coupons
Pages
├── Page Builder
├── SEO
├── Testimonials
Settings
```

**Removed:** "Contacts" and "Students" as separate items. Replaced by single "Clients".

---

## 3. Admin Client List

**Route:** `/admin/clients`

```
Clients
127 total · 98 active · 12 potential

[All] [Active] [Potential] [Inactive] [Archived]

[Search by name or email...]

┌──────────────────────────────────────────────────────────────────────┐
│ Name           │ Email              │ Status │ Credits │ Sessions │  │
├────────────────┼────────────────────┼────────┼─────────┼──────────┤  │
│ Sarah Johnson  │ sarah@example.com  │ Active │ 5       │ 20       │→ │
│ John Smith     │ john@example.com   │ Active │ 3       │ 8        │→ │
│ Jane Doe       │ jane@example.com   │ Potent │ 0       │ 0        │→ │
│ Mike Brown     │ mike@example.com   │ Inactv │ 0       │ 15       │→ │
└──────────────────────────────────────────────────────────────────────┘
```

Each row: name, email, phone (desktop), status badge (green=active, blue=potential, grey=inactive, red=archived), credits remaining, completed sessions, last session date, onboarding (✓ or X/3). Click → profile.

Potential clients show "Convert" button inline or on their profile.

---

## 4. Admin Client Profile — 8 Tabs

**Route:** `/admin/clients/[id]`

### Tab 1: Overview (default)

```
┌─────────────────────────────────────────────────────────────────┐
│ Sarah Johnson                              [Active ●] [Edit ▼] │
│ sarah@example.com · +27 82 123 4567       Member since Jan 2025│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│ │ Sessions  │ │ Credits   │ │ Next      │ │ Onboarding│       │
│ │   20      │ │   5       │ │ Tue 4 Mar │ │ Complete ✓│       │
│ │ completed │ │ remaining │ │ 10:00 AM  │ │ 3 of 3    │       │
│ └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📊 Client Insights                                         │ │
│ │                                                             │ │
│ │ ATTENDANCE                                                  │ │
│ │ ████████░░ 80% attendance rate                              │ │
│ │ 20 completed · 2 late cancels · 1 no-show · 2 cancelled    │ │
│ │                                                             │ │
│ │ ENGAGEMENT                                                  │ │
│ │ Current streak: 8 sessions · Longest: 12                    │ │
│ │ Avg gap: 7 days · Last session: 3 days ago                  │ │
│ │                                                             │ │
│ │ PATTERNS                                                    │ │
│ │ Reschedule rate: Low (8%) · Late cancel: Low (8%)          │ │
│ │ No-show rate: Very low (4%)                                │ │
│ │                                                             │ │
│ │ ⚠️  2 credits expire 15 Apr 2026                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📝 Admin Notes                                             │ │
│ │ Prefers morning sessions. Good progress on self-esteem.    │ │
│ │ [Edit Notes]                                                │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 2: Personal

```
┌─────────────────────────────────────────────────────────────────┐
│ Personal Details                                    [Edit]      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ First name      Sarah            Last name      Johnson         │
│ Date of birth   15 May 1990      Age            35              │
│ Gender          Female           Relationship   Married         │
│ Phone           +27 82 123 4567  Address        12 Oak St, Paarl│
│ Email           sarah@example.com                               │
│ Emergency       John Johnson, +27 83 456 7890                   │
│ Referral        Friend — "My sister recommended Roxanne"        │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 💜 Couples Link (future phase)                             │ │
│ │ Not linked to a couple                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 3: Assessment

```
┌─────────────────────────────────────────────────────────────────┐
│ Assessment                          Last edited: Admin, 2 Mar  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Experienced Behaviours                                          │
│                                                                 │
│ [Anxiety/Stress ✓] [Insomnia ✓] [Low Self-Esteem ✓]           │
│ [Procrastination] [Crying ✓] [Negative Thoughts ✓]            │
│ [Avoidance] [Isolation] [Eating Problems] ...                  │
│                                                                 │
│ Other: "Difficulty setting boundaries at work"                  │
│                                                                 │
│ Experienced Feelings                                            │
│                                                                 │
│ [Sadness ✓] [Frustrated ✓] [Stuck ✓] [Tense ✓]              │
│ [Doubt] [Anger] [Confused] [Hopeless] ...                      │
│                                                                 │
│ Physical Symptoms                                               │
│                                                                 │
│ [Headaches ✓] [Fatigue ✓] [Tension ✓]                         │
│ [Stomach Problems] [Back Pain] ...                              │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔒 Admin Notes (not visible to client)                     │ │
│ │                                                             │ │
│ │ Shows signs of burnout. Explore work-life boundaries in    │ │
│ │ next session. Consider recommending journaling exercise.   │ │
│ │                                                             │ │
│ │ [Edit Admin Notes]                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                                           [Save Changes]        │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 4: Commitment — Audit Trail

```
┌─────────────────────────────────────────────────────────────────┐
│ Commitment Agreement                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Current Version: v2                                             │
│ Status: ✅ Acknowledged                                         │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Acknowledgement History                                     │ │
│ │                                                             │ │
│ │ v2  Acknowledged  4 Mar 2026 at 14:32                      │ │
│ │     IP: 105.22.xxx.xxx · Chrome on Windows                 │ │
│ │     Reason: Policy update — cancellation window changed    │ │
│ │                                                             │ │
│ │ v1  Acknowledged  15 Jan 2026 at 09:15                     │ │
│ │     IP: 105.22.xxx.xxx · Chrome on Windows                 │ │
│ │     Reason: Initial onboarding                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [View Current Commitment Text]                                  │
│ [Require Re-Acknowledgement →] (bumps to next version)         │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 5: Sessions

```
┌─────────────────────────────────────────────────────────────────┐
│ Sessions                                    [Book on Behalf]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ UPCOMING                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🟢 Individual · Tue 4 Mar 2026 at 10:00 · 60 min          │ │
│ │ Status: Confirmed · Teams: [Join] · Reschedules: 0/2       │ │
│ │ [Reschedule] [Cancel] [Mark No-Show]                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ PAST                                                            │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✓ Individual · Mon 24 Feb 2026 at 10:00 · Completed        │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ⚠️ Individual · Mon 10 Feb 2026 at 10:00 · Late Cancel     │ │
│ │   Cancelled by client · Credit forfeited                    │ │
│ │   Original date: Mon 3 Feb (rescheduled 2 Feb)             │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ✗ Individual · Mon 3 Feb 2026 at 10:00 · No-Show           │ │
│ │   Credit forfeited                                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

Admin actions on sessions:
- **Mark No-Show** — status → `no_show`, forfeit credit
- **Cancel with Refund** — admin override, always refunds regardless of policy
- **Reschedule** — admin override, no reschedule limit
- **Book on Behalf** — create booking for client, deduct credit

### Tab 6: Purchases

```
┌─────────────────────────────────────────────────────────────────┐
│ Purchases                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ SESSION PACKAGES                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 10 Session Package · Purchased 15 Jan 2026 · R5,500.00     │ │
│ │ Credits: 5 remaining of 10 · Expires: 15 Jul 2026          │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 5 Session Package · Purchased 1 Nov 2025 · R3,000.00       │ │
│ │ Credits: 0 remaining of 5 · Fully used                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ COURSES                                                         │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Master Your Confidence · Enrolled 20 Feb 2026 · R2,500.00  │ │
│ │ Progress: 60% (6 of 10 lessons) · [View →]                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ DIGITAL PRODUCTS                                                │
│ │ (None yet)                                                  │ │
│                                                                 │
│ [Grant Credits]  [Enrol in Course]                              │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 7: Finances

```
┌─────────────────────────────────────────────────────────────────┐
│ Finances                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ CREDIT BALANCE                                                  │
│ ┌───────────┐ ┌───────────┐                                    │
│ │ Individual│ │ Couples   │  (couples only if linked — future) │
│ │    5      │ │    3      │                                    │
│ │ credits   │ │ credits   │                                    │
│ └───────────┘ └───────────┘                                    │
│                                                                 │
│ TRANSACTION HISTORY                                             │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Date       │ Type       │ Amount │ Balance │ Description    │ │
│ ├────────────┼────────────┼────────┼─────────┼────────────────┤ │
│ │ 4 Mar 2026 │ 🔴 Forfeit │ -1     │ 5       │ Late cancel   │ │
│ │ 24 Feb     │ 🔵 Used    │ -1     │ 6       │ Session       │ │
│ │ 20 Feb     │ 🟢 Refund  │ +1     │ 7       │ Cancel refund │ │
│ │ 17 Feb     │ 🔵 Used    │ -1     │ 6       │ Session       │ │
│ │ 15 Jan     │ 🟢 Purchase│ +10    │ 7       │ 10-pack       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ PAYMENT HISTORY                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Date       │ Amount     │ Status  │ Reference              │ │
│ ├────────────┼────────────┼─────────┼────────────────────────┤ │
│ │ 15 Jan 2026│ R5,500.00  │ ✅ Paid  │ PAY-2026-001          │ │
│ │ 1 Nov 2025 │ R3,000.00  │ ✅ Paid  │ PAY-2025-089          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Grant Credits]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tab 8: Communications

```
┌─────────────────────────────────────────────────────────────────┐
│ Communications                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ EMAIL PREFERENCES                                               │
│ Newsletter:        ✅ Opted in    [Toggle]                       │
│ Marketing emails:  ✅ Opted in    [Toggle]                       │
│ SMS notifications: ❌ Not opted in [Toggle]                      │
│ Session reminders: ✅ Enabled     [Toggle]                       │
│ Global opt-out:    ❌ No          [Toggle]                       │
│ Paused:            ❌ No                                         │
│                                                                 │
│ DRIP SEQUENCE                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Phase: Onboarding · Step 3 of 5 · Last sent: 20 Feb        │ │
│ │ Status: Active                       [Pause] [Reset]        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ CAMPAIGN HISTORY                                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Campaign               │ Sent    │ Opened │ Clicked         │ │
│ ├────────────────────────┼─────────┼────────┼─────────────────┤ │
│ │ February Newsletter    │ 1 Feb   │ ✅ Yes  │ ✅ 2 clicks     │ │
│ │ New Year Promo         │ 5 Jan   │ ✅ Yes  │ ❌ No           │ │
│ │ December Tips          │ 1 Dec   │ ❌ No   │ ❌ No           │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ RECENT EMAILS                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Date    │ Subject                     │ Status │ Opened     │ │
│ ├─────────┼─────────────────────────────┼────────┼────────────┤ │
│ │ 4 Mar   │ Session Reminder — Tomorrow │ ✅ Sent │ ✅ Opened  │ │
│ │ 1 Mar   │ February Newsletter         │ ✅ Sent │ ✅ Opened  │ │
│ │ 24 Feb  │ Booking Confirmed           │ ✅ Sent │ ✅ Opened  │ │
│ │ 20 Feb  │ Welcome to Life Therapy     │ ✅ Sent │ ✅ Opened  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ TAGS                                                            │
│ [individual-client] [newsletter] [imported] [+ Add Tag]         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Client Insights Engine

**File:** `lib/admin/client-insights.ts`

All computed from existing `bookings` + `session_credit_transactions` data. No new tables.

```typescript
interface ClientInsights {
  // Attendance
  totalBookings: number;
  completedSessions: number;
  cancelledSessions: number;
  lateCancels: number;
  noShows: number;
  attendanceRate: number;          // completed / (completed + noShows + lateCancels) * 100
  
  // Engagement
  currentStreak: number;           // consecutive completed sessions without gaps > 21 days
  longestStreak: number;
  avgDaysBetweenSessions: number;
  daysSinceLastSession: number;
  
  // Patterns
  rescheduleRate: number;          // bookings with rescheduleCount > 0 / totalBookings * 100
  lateCancelRate: number;
  noShowRate: number;
  
  // Credits
  creditsRemaining: number;
  creditsExpiringSoon: { count: number; expiryDate: Date } | null;
  
  // Flags (admin attention items)
  flags: InsightFlag[];
}

type InsightFlag = 
  | { type: "credit_expiry"; message: string; severity: "warning" }
  | { type: "engagement_gap"; message: string; severity: "warning" }
  | { type: "high_cancel_rate"; message: string; severity: "info" }
  | { type: "no_upcoming"; message: string; severity: "info" };
```

**Rate labels:** 0-10% "Very low" (green), 11-20% "Low" (green), 21-35% "Moderate" (amber), 36%+ "High" (red).

**Calculation logic:**

```typescript
export async function getClientInsights(studentId: string): Promise<ClientInsights> {
  const bookings = await prisma.booking.findMany({
    where: { studentId },
    orderBy: { date: "asc" },
  });

  const completed = bookings.filter(b => b.status === "completed");
  const cancelled = bookings.filter(b => b.status === "cancelled");
  const lateCancels = cancelled.filter(b => b.isLateCancel);
  const noShows = bookings.filter(b => b.status === "no_show");
  const rescheduled = bookings.filter(b => b.rescheduleCount > 0);

  // Attendance: completed out of sessions that happened/should have happened
  const relevantTotal = completed.length + noShows.length + lateCancels.length;
  const attendanceRate = relevantTotal > 0 ? (completed.length / relevantTotal) * 100 : 100;

  // Streaks: consecutive completed sessions with <= 21 day gap
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  for (let i = 0; i < completed.length; i++) {
    if (i === 0) { tempStreak = 1; }
    else {
      const gap = differenceInDays(completed[i].date, completed[i - 1].date);
      tempStreak = gap <= 21 ? tempStreak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }
  currentStreak = tempStreak;

  // Average gap between sessions
  const gaps: number[] = [];
  for (let i = 1; i < completed.length; i++) {
    gaps.push(differenceInDays(completed[i].date, completed[i - 1].date));
  }
  const avgGap = gaps.length > 0 ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 0;

  // Days since last session
  const lastCompleted = completed[completed.length - 1];
  const daysSinceLast = lastCompleted ? differenceInDays(new Date(), lastCompleted.date) : -1;

  // Credit expiry (credits valid 6 months from purchase)
  const creditBalance = await getBalance(studentId);
  const expiringCredits = await getExpiringCredits(studentId, 30);

  // Generate flags
  const flags: InsightFlag[] = [];
  if (expiringCredits && expiringCredits.count > 0) {
    flags.push({ type: "credit_expiry", message: `${expiringCredits.count} credit(s) expire ${formatDate(expiringCredits.expiryDate)}`, severity: "warning" });
  }
  if (daysSinceLast > 21) {
    flags.push({ type: "engagement_gap", message: `No session in ${daysSinceLast} days`, severity: "warning" });
  }
  if (bookings.length >= 5 && (lateCancels.length / bookings.length) > 0.2) {
    flags.push({ type: "high_cancel_rate", message: `Late cancel rate: ${Math.round((lateCancels.length / bookings.length) * 100)}%`, severity: "info" });
  }
  const hasUpcoming = bookings.some(b => ["pending", "confirmed"].includes(b.status) && b.date > new Date());
  if (!hasUpcoming && creditBalance > 0) {
    flags.push({ type: "no_upcoming", message: `${creditBalance} credits but no upcoming session`, severity: "info" });
  }

  return {
    totalBookings: bookings.length,
    completedSessions: completed.length,
    cancelledSessions: cancelled.length,
    lateCancels: lateCancels.length,
    noShows: noShows.length,
    attendanceRate: Math.round(attendanceRate),
    currentStreak,
    longestStreak,
    avgDaysBetweenSessions: avgGap,
    daysSinceLastSession: daysSinceLast,
    rescheduleRate: bookings.length > 0 ? Math.round((rescheduled.length / bookings.length) * 100) : 0,
    lateCancelRate: bookings.length > 0 ? Math.round((lateCancels.length / bookings.length) * 100) : 0,
    noShowRate: bookings.length > 0 ? Math.round((noShows.length / bookings.length) * 100) : 0,
    creditsRemaining: creditBalance,
    creditsExpiringSoon: expiringCredits,
    flags,
  };
}
```

---

## 6. Portal — Client Self-Service

### 6.1 Pages

| Page | Route | Content |
|------|-------|---------|
| **Dashboard** | `/portal` | Welcome, next session, credits, onboarding progress |
| **Profile** | `/portal/profile` | Personal details + Assessment (2 tabs within page) |
| **Sessions** | `/portal/bookings` | Upcoming + past, book new, reschedule, cancel |
| **Purchases** | `/portal/purchases` | Packages, courses, digital products |
| **Credits** | `/portal/credits` | Balance + transaction history |
| **Commitment** | `/portal/commitment` | Read-only view of what they signed |
| **Preferences** | `/portal/preferences` | Communication preferences (newsletter, marketing, SMS) |
| **Onboarding** | `/portal/onboarding` | 3-step wizard (initial setup only) |

### 6.2 Portal Sidebar

```
Dashboard
My Sessions        (badge: upcoming count)
My Courses         (if enrolled in any)
My Purchases
Credits
Profile
Preferences
Commitment
Account Settings
```

### 6.3 Onboarding — 3-Step Wizard

**Step 1: Personal Details**

```
Step 1 of 3: Personal Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[●━━━━━━━━━●───────────●]

┌──────────────────────────────────────┐
│ Personal Information                 │
│                                      │
│ First name: [Sarah      ]            │
│ Last name:  [Johnson    ]            │
│ Date of birth: [1990-05-15]          │
│ Gender: [Female ▼]                   │
│ Phone: [+27 82 123 4567]            │
│ Address: [_______________]           │
│                                      │
│ Relationship status: [Married ▼]     │
│ Emergency contact: [John, 082...]    │
│                                      │
│ How did you hear about Life Therapy? │
│ [Friend/Family ▼]                    │
│ Details: [My sister recommended...]  │
│                                      │
│        [Save & Continue →]           │
└──────────────────────────────────────┘
```

**Step 2: Assessment**

```
Step 2 of 3: Assessment
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[●━━━━━━━━━●━━━━━━━━━━●]

This helps Roxanne prepare for your sessions.
Select anything that applies — you can update
this anytime.

┌──────────────────────────────────────┐
│ Experienced Behaviours               │
│                                      │
│ [Anxiety/Stress ✓] [Insomnia]        │
│ [Low Self-Esteem ✓] [Isolation]      │
│ [Procrastination] [Crying ✓]         │
│ [Negative Thoughts ✓] [Avoidance]    │
│ ... (all options as toggle chips)    │
│                                      │
│ Other: [________________________]    │
│                                      │
│ Experienced Feelings                 │
│                                      │
│ [Sadness ✓] [Doubt] [Anger]          │
│ [Frustrated ✓] [Stuck ✓] [Confused]  │
│ ... (all options as toggle chips)    │
│                                      │
│ Other: [________________________]    │
│                                      │
│ Physical Symptoms                    │
│                                      │
│ [Headaches ✓] [Fatigue ✓] [Tension]  │
│ [Insomnia] [Back Pain] [Sweating]    │
│ ... (all options as toggle chips)    │
│                                      │
│ Other: [________________________]    │
│                                      │
│ Additional notes for Roxanne:        │
│ [________________________________]  │
│                                      │
│  [← Back]    [Save & Continue →]     │
└──────────────────────────────────────┘
```

Pre-filled items by Roxanne show with subtle indicator (faint border or small label). Client can toggle off.

**Step 3: Commitment Agreement**

```
Step 3 of 3: Commitment Agreement
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[●━━━━━━━━━●━━━━━━━━━━●]

┌──────────────────────────────────────┐
│ Welcome to Life Therapy              │
│                                      │
│ MY COMMITMENT TO YOU                 │
│                                      │
│ I will be ready and prepared for     │
│ your sessions at the agreed time.    │
│ During your session I will devote    │
│ 100% of my energy to helping you     │
│ achieve your goals.                  │
│                                      │
│ If I'm unable to have your session   │
│ I will let you know at least 24      │
│ hours in advance.                    │
│                                      │
│ HOW SESSIONS WORK                    │
│                                      │
│ Sessions are 60 minutes via          │
│ Microsoft Teams. You'll receive a    │
│ Teams link with every booking.       │
│                                      │
│ RESCHEDULING & CANCELLATIONS         │
│                                      │
│ Reschedule: 24 hours notice          │
│ Cancel: 48 hours notice              │
│ Late cancellation or no-show:        │
│   session credit is forfeited        │
│ Maximum 2 reschedules per session    │
│ Emergencies handled case-by-case     │
│                                      │
│ SESSION CREDITS                      │
│                                      │
│ Valid for 6 months from purchase.    │
│ Non-refundable but transferable      │
│ between session types.               │
│                                      │
│ CONFIDENTIALITY                      │
│                                      │
│ All shared information during your   │
│ sessions is 100% confidential.       │
│                                      │
│ YOUR COMMITMENT                      │
│                                      │
│ I confirm that all information       │
│ provided is true and correct. I      │
│ understand and accept the session    │
│ and cancellation policies above.     │
│                                      │
│ ☐ I have read and agree to the above │
│                                      │
│ [← Back]    [I Agree — Let's Start]  │
└──────────────────────────────────────┘
```

### 6.4 Portal Dashboard

```
┌────────────────────────────────────────────────┐
│ Welcome back, Sarah                            │
│                                                │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│ │ Sessions │ │ Credits  │ │ Courses  │       │
│ │    2     │ │    5     │ │    1     │       │
│ │ upcoming │ │ remaining│ │ enrolled │       │
│ └──────────┘ └──────────┘ └──────────┘       │
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │ 📅 Next Session                            │ │
│ │ Individual · Tue 4 Mar at 10:00 · 60 min  │ │
│ │ [Join Teams]  [View All Sessions]          │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌────────────────────────────────────────────┐ │
│ │ 📋 Complete Your Profile (2 of 3)         │ │
│ │ Next: Assessment                           │ │
│ │ [Continue →]                               │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

- "Next Session" card: only if session within 7 days. "Join Teams" only on session day.
- "Complete Your Profile" card: only if `onboardingStep < 3`.

### 6.5 Portal Profile Page

Two tabs within profile:

**Personal Details tab:** Editable form — name, DOB, gender, phone, address, emergency contact, referral. Save → updates Student.

**Assessment tab:** Same toggle chips as admin, but no admin-only notes field. Pre-filled items show indicator. Client can toggle on/off, add "Other" text. Save → updates ClientIntake with `lastEditedBy: "client"`.

### 6.6 Portal Credits Page

```
┌────────────────────────────────────────────────┐
│ My Credits                                     │
│                                                │
│ ┌──────────────┐ ┌──────────────┐             │
│ │ Individual   │ │ Couples      │             │
│ │     5        │ │     3        │             │
│ │ credits      │ │ credits      │ (if linked) │
│ └──────────────┘ └──────────────┘             │
│                                                │
│ Transaction History                            │
│                                                │
│ 4 Mar  🔴 Late cancel — credit forfeited  -1  │
│ 24 Feb 🔵 Session attended               -1  │
│ 20 Feb 🟢 Cancelled — credit refunded    +1  │
│ 17 Feb 🔵 Session attended               -1  │
│ 15 Jan 🟢 10 Session Package purchased  +10  │
└────────────────────────────────────────────────┘
```

### 6.7 Portal Purchases Page

```
┌────────────────────────────────────────────────┐
│ My Purchases                                   │
│                                                │
│ SESSION PACKAGES                               │
│ ┌────────────────────────────────────────────┐ │
│ │ 10 Session Package · 15 Jan 2026          │ │
│ │ 5 of 10 credits remaining                 │ │
│ │ Expires: 15 Jul 2026                      │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ COURSES                                        │
│ ┌────────────────────────────────────────────┐ │
│ │ Master Your Confidence                     │ │
│ │ Progress: 60% · [Continue Learning →]      │ │
│ └────────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

### 6.8 Portal Commitment Page

Read-only: version, date acknowledged, full commitment text. "If you have questions, contact Roxanne."

### 6.9 Portal Preferences Page

Communication preferences (editable by client):
- Newsletter opt-in toggle
- Marketing emails toggle
- SMS notifications toggle
- Session reminders toggle

Clients see NO behavioural insights — just their own data.

---

## 7. Booking Policy Engine

### 7.1 Rules

| Action | Notice | Credit Impact |
|--------|--------|---------------|
| Cancel | 48+ hours | Credit refunded |
| Cancel | Under 48 hours | Credit forfeited |
| Reschedule | 24+ hours | No impact |
| Reschedule | Under 24 hours | Not allowed |
| No-show | N/A | Credit forfeited |
| Reschedule → Cancel | Anti-abuse | Forfeited if original within 48hr |

Max 2 reschedules per booking.

### 7.2 Anti-Abuse Mechanism

**The problem:** Client has session tomorrow (within 48hr cancel window). Can't cancel without losing credit. So they reschedule to next week (24hr notice OK), then cancel the rescheduled session (now 48+ hours away). Free cancellation achieved.

**The solution:** Track `originalDate` and `originalStartTime` on every booking. Set on creation, NEVER changed. When rescheduling, `date` changes but `originalDate` stays. On cancel:

```
Was this booking rescheduled?
  YES → Was the ORIGINAL date within 48hr when the reschedule happened?
    YES → Late cancel. Credit forfeited.
    NO  → Normal cancel rules apply.
  NO → Normal cancel rules apply.
```

### 7.3 Policy Engine Code

**File:** `lib/booking-policy.ts`

```typescript
const CANCEL_NOTICE_HOURS = 48;
const RESCHEDULE_NOTICE_HOURS = 24;
const MAX_RESCHEDULES = 2;

interface BookingForPolicy {
  date: Date;
  startTime: string;
  originalDate: Date | null;
  originalStartTime: string | null;
  rescheduledAt: Date | null;
  rescheduleCount: number;
  status: string;
}

interface CancelPolicyResult {
  canCancel: boolean;
  isLateCancel: boolean;
  creditRefunded: boolean;
  reason: string;
  hoursUntilSession: number;
}

interface ReschedulePolicyResult {
  canReschedule: boolean;
  reason: string;
}

export function evaluateCancelPolicy(booking: BookingForPolicy): CancelPolicyResult {
  const now = new Date();
  const sessionDateTime = buildDateTime(booking.date, booking.startTime);
  const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSession <= 0) {
    return { canCancel: false, isLateCancel: false, creditRefunded: false, reason: "Session has already started or passed.", hoursUntilSession };
  }

  if (booking.status === "cancelled") {
    return { canCancel: false, isLateCancel: false, creditRefunded: false, reason: "Already cancelled.", hoursUntilSession };
  }

  // Anti-abuse check
  let isLateCancel = false;

  if (booking.rescheduledAt && booking.originalDate && booking.originalStartTime) {
    const originalSessionDateTime = buildDateTime(booking.originalDate, booking.originalStartTime);
    const hoursFromRescheduleToOriginal = (originalSessionDateTime.getTime() - booking.rescheduledAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursFromRescheduleToOriginal < CANCEL_NOTICE_HOURS) {
      isLateCancel = true;
    }
  }

  // Standard check
  if (!isLateCancel && hoursUntilSession < CANCEL_NOTICE_HOURS) {
    isLateCancel = true;
  }

  return {
    canCancel: true,
    isLateCancel,
    creditRefunded: !isLateCancel,
    reason: isLateCancel
      ? "This cancellation is within the 48-hour policy window. Your session credit will not be refunded."
      : "Your session credit will be refunded.",
    hoursUntilSession,
  };
}

export function evaluateReschedulePolicy(booking: BookingForPolicy): ReschedulePolicyResult {
  const now = new Date();
  const sessionDateTime = buildDateTime(booking.date, booking.startTime);
  const hoursUntilSession = (sessionDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilSession <= 0) return { canReschedule: false, reason: "Session has already started or passed." };
  if (booking.status === "cancelled") return { canReschedule: false, reason: "Already cancelled." };
  if (booking.rescheduleCount >= MAX_RESCHEDULES) return { canReschedule: false, reason: `Maximum ${MAX_RESCHEDULES} reschedules reached. Please contact Roxanne.` };
  if (hoursUntilSession < RESCHEDULE_NOTICE_HOURS) return { canReschedule: false, reason: "Rescheduling requires at least 24 hours notice." };

  return { canReschedule: true, reason: "You can reschedule this session." };
}

function buildDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const dt = new Date(date);
  dt.setHours(h, m, 0, 0);
  return dt;
}
```

### 7.4 Cancel Dialog — Three States

**Normal cancel (48+ hours, no anti-abuse):**
```
┌──────────────────────────────────────────┐
│  Cancel Session                          │
│                                          │
│  Are you sure you want to cancel your    │
│  session on Tuesday 4 March at 10:00?    │
│                                          │
│  ✅ Your session credit will be refunded. │
│                                          │
│  Optional: reason for cancellation       │
│  [________________________]              │
│                                          │
│  [Keep Session]  [Cancel Session]        │
└──────────────────────────────────────────┘
```

**Late cancel (under 48hr):**
```
┌──────────────────────────────────────────┐
│  ⚠️  Late Cancellation                   │
│                                          │
│  Your session on Tuesday 4 March at      │
│  10:00 is within the 48-hour policy      │
│  window.                                 │
│                                          │
│  ❌ Your session credit will NOT be       │
│  refunded.                               │
│                                          │
│  Would you like to reschedule instead?   │
│                                          │
│  [Reschedule Instead]                    │
│  [Cancel Anyway — I accept the charge]   │
│  [Keep Session]                          │
└──────────────────────────────────────────┘
```

**Anti-abuse triggered (rescheduled from within window):**
```
┌──────────────────────────────────────────┐
│  ⚠️  Late Cancellation                   │
│                                          │
│  This session was rescheduled from an    │
│  earlier date that was within the        │
│  48-hour cancellation window.            │
│                                          │
│  ❌ Your session credit will NOT be       │
│  refunded.                               │
│                                          │
│  [Cancel — I accept the charge]          │
│  [Keep Session]                          │
└──────────────────────────────────────────┘
```

No "Reschedule Instead" option — they already used reschedule to circumvent.

---

## 8. Free Consultation → Auto Portal Access

### 8.1 Updated Booking Flow

**File:** `app/(public)/book/actions.ts` → `createBooking()`

When `sessionType === "free_consultation"`:

```typescript
// Check if student already exists (returning client)
const existingStudent = await prisma.student.findUnique({ where: { email: normalizedEmail } });

if (!existingStudent) {
  // 1. Create Supabase auth user with temp password
  const tempPassword = generateTempPassword(); // e.g. "LT-Abc123!"
  const { data: authData } = await supabaseAdmin.auth.admin.createUser({
    email: normalizedEmail,
    password: tempPassword,
    email_confirm: true,
  });

  // 2. Create Student record (minimal — from booking data)
  const nameParts = clientName.trim().split(/\s+/);
  const student = await prisma.student.create({
    data: {
      supabaseUserId: authData.user.id,
      email: normalizedEmail,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" ") || "",
      phone: clientPhone || null,
      mustChangePassword: true,
      onboardingStep: 0,
      clientStatus: "potential",
      source: "booking",
      consentGiven: true,
      consentDate: new Date(),
      consentMethod: "booking_form",
    },
  });

  // 3. Create empty intake record
  await prisma.clientIntake.create({
    data: { studentId: student.id },
  });

  // 4. Link booking to student
  await prisma.booking.update({
    where: { id: booking.id },
    data: { 
      studentId: student.id,
      originalDate: bookingDate,
      originalStartTime: startTime,
    },
  });

  // 5. Send portal welcome email
  await sendEmail({
    to: normalizedEmail,
    ...await renderEmail("portal_welcome", {
      firstName: nameParts[0],
      tempPassword,
      loginUrl: `${baseUrl}/portal/login`,
      sessionDate: dateStr,
      sessionTime: timeStr,
    }),
  });
} else {
  // Existing student — just link the booking
  await prisma.booking.update({
    where: { id: booking.id },
    data: { 
      studentId: existingStudent.id,
      originalDate: bookingDate,
      originalStartTime: startTime,
    },
  });
}
```

### 8.2 Temp Password Generator

**File:** `lib/auth/temp-password.ts`

```typescript
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "LT-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result + "!";
}
```

### 8.3 Portal Welcome Email

**File:** `components/email/portal-welcome.tsx`

```
Subject: Your Life Therapy Portal is Ready

Hi [firstName],

Your free consultation is confirmed for [date] at [time].

In the meantime, your personal portal is ready:

[Login to Your Portal →]

Email: [email]
Temporary password: [tempPassword]

You'll be asked to set your own password on first login.

In your portal you can:
• View your scheduled sessions
• Update your personal details

Looking forward to meeting you!

Roxanne Bouwer
Accredited Coach & Counsellor
```

---

## 9. Convert Potential → Active (Admin)

### 9.1 Convert Action

When Roxanne clicks "Convert to Client" on a potential client:

**Dialog shows:**
1. Client info (pre-filled: name, email, phone)
2. Package selection (dropdown of HybridPackages or "No package")
3. Credits to grant (auto-fills from package)
4. **Quick Assessment** (collapsible): behaviour/feeling/symptom chips — Roxanne ticks items during consultation
5. Admin notes

**On submit:**
1. Update Student: `clientStatus = "active"`, `convertedAt = now()`, `convertedBy = adminId`
2. If package selected: create Order, grant credits via `addCredits()`
3. If assessment chips selected: update ClientIntake with `lastEditedBy: "admin"`
4. Send "You're now a client" confirmation email

---

## 10. Client Migration (Existing Contacts → Students)

### 10.1 Data Migration

SQL migration (see Section 1.8) copies Contact data into Student records:
- Contacts WITH studentId: merge marketing fields into existing Student
- Contacts WITHOUT studentId: create new Student records with placeholder auth
- Relink DripProgress and CampaignProgress from contactId → studentId

### 10.2 Admin Import Page

**Route:** `/admin/clients/import`

Two modes:

**Manual entry** — form for single client:
- Name, email, phone (required)
- Credit balance to grant (optional)
- Notes

**CSV upload** — bulk:
```csv
first_name,last_name,email,phone,credits
Sarah,Johnson,sarah@example.com,+27821234567,5
John,Smith,john@example.com,+27831234567,3
```

Per import:
1. Create Supabase auth user with temp password
2. Create Student (`clientStatus: "active"`, `onboardingStep: 2`, `source: "import"`)
3. Create empty ClientIntake
4. Grant credits if specified
5. Send welcome email

### 10.3 Welcome Email for Migrated Clients

```
Subject: Life Therapy Has a New Home — Your Portal is Ready

Hi [firstName],

We've upgraded! You now have a personal online portal where you
can manage your sessions, view your credits, and more.

[Login to Your Portal →]

Email: [email]
Temporary password: [tempPassword]

What's new:
• View and manage your upcoming sessions
• Book new sessions using your credits
• Reschedule or cancel online (24hr/48hr notice)

On your first login, you'll be asked to review our updated
session agreement which includes some changes to our
cancellation policy.

Roxanne
```

### 10.4 Migrated Client First Login

1. Set new password (existing `mustChangePassword` flow)
2. Redirected to Step 3 only (commitment with updated cancellation policy)
3. After acknowledging → full portal access
4. Steps 1 & 2 available in profile but not required

---

## 11. Code Updates Required

### 11.1 Files Referencing Contact That Must Change to Student

All code that queries the `Contact` model for client/subscriber purposes needs to query `Student` instead:

- Campaign sending logic (query subscribers)
- Drip email cron (query drip progress)
- Unsubscribe endpoint
- Newsletter signup action
- Contact form submission action (may still create Contact for non-client inquiries, or create Student with `source: "website"`)
- Admin contacts page → becomes client list
- Admin contact detail → becomes client profile
- Booking form `upsertContact()` → creates/updates Student instead

### 11.2 Route Changes

| Old Route | New Route | Notes |
|-----------|-----------|-------|
| `/admin/students` | `/admin/clients` | Renamed, enhanced |
| `/admin/students/[id]` | `/admin/clients/[id]` | 8-tab profile |
| `/admin/contacts` | `/admin/clients` | Merged into clients |
| `/admin/contacts/[id]` | `/admin/clients/[id]` | Merged |
| `/admin/contacts/import` | `/admin/clients/import` | Moved |
| `/admin/contacts/new` | `/admin/clients/new` | Moved |

Add redirects from old routes for bookmarks.

---

## 12. Implementation Phases

### Phase 1: Schema Migration — Merge Contact into Student (3-4 hours)
1. Add all Contact fields to Student model (marketing, consent, communication prefs, source, tags, adminNotes)
2. Relink DripProgress + CampaignProgress from Contact → Student
3. Write data migration SQL: copy Contact data into Student records
4. Create `lib/intake-options.ts` (constant arrays for behaviours, feelings, symptoms)
5. Create `lib/commitment.ts` (version constant)
6. Create `lib/auth/temp-password.ts`
7. Update `createBooking()` for free consultations: auto-create Student + auth + intake + portal welcome email
8. New email template: `portal_welcome`
9. Update all code that queries Contact to query Student instead (campaigns, drip, unsubscribe, newsletter, etc.)

### Phase 2: Admin Client List Page (3-4 hours)
1. New route `/admin/clients` with filter tabs (All, Active, Potential, Inactive, Archived)
2. Search by name/email
3. List columns: name, email, status, credits, sessions, last session, onboarding
4. Profile page shell with 8 tab navigation
5. Update admin sidebar: single "Clients" link, remove "Contacts" and "Students"
6. Redirect old routes → new routes

### Phase 3: Admin Profile Tabs 1-4 (4-5 hours)
1. Overview: stat cards + client insights panel + admin notes
2. `lib/admin/client-insights.ts` calculation engine
3. Personal: profile form + communication preferences section
4. Assessment: toggle chips component (shared with portal), admin notes, save with `lastEditedBy`
5. Commitment: audit trail display, re-acknowledge button, view commitment text

### Phase 4: Admin Profile Tabs 5-8 (4-5 hours)
1. Sessions: booking list with admin actions (no-show, cancel with refund, reschedule override, book on behalf)
2. Purchases: packages with credit tracking, course enrolments with progress, digital products, admin grant actions
3. Finances: credit balances, transaction history (colour coded), payment/order history
4. Communications: email prefs toggles, drip status with pause/reset, campaign history with open/click data, recent email log, tag management

### Phase 5: Portal Onboarding + Profile (4-5 hours)
1. `/portal/onboarding` 3-step wizard
2. Step 1: personal details form (auto-save)
3. Step 2: assessment chips (auto-save, pre-filled indicator for admin-filled items)
4. Step 3: commitment acknowledge (checkbox + button, captures IP + user agent)
5. Portal profile: personal details tab + assessment tab (client-editable)
6. Portal preferences: communication pref toggles
7. Portal commitment: read-only view of what they signed
8. Onboarding gate: block booking until step 3 done
9. Dashboard: onboarding progress card

### Phase 6: Portal Bookings + Policy Engine (4-5 hours)
1. `lib/booking-policy.ts` with cancel/reschedule engine + anti-abuse
2. My Sessions page: upcoming + past with policy-aware buttons
3. Book New Session: date/time picker, credit deduction, gated on commitment
4. Reschedule page: availability picker, originalDate preservation, max 2 reschedules
5. Cancel dialog: 3 states (normal, late, anti-abuse)
6. Credit refund/forfeiture logic
7. Calendar event updates on reschedule/cancel
8. Email templates: reschedule confirmation, updated cancellation with credit status

### Phase 7: Portal Dashboard + Remaining Pages (3-4 hours)
1. Dashboard: next session card (Teams link on day only), stat cards, onboarding progress
2. Purchases page: packages with remaining credits, courses with progress
3. Credits page: balance + transaction history with forfeiture display
4. Sidebar with all links + upcoming session badge

### Phase 8: Client Migration + Import (2-3 hours)
1. `/admin/clients/import` manual entry + CSV upload
2. Contact → Student data migration execution
3. Welcome email template for migrated clients
4. First-login flow: password → commitment only (skip profile + assessment)

### Phase 9: Convert + Polish (2-3 hours)
1. "Convert to Client" dialog on potential clients with quick assessment chips
2. Clean up deprecated Contact code references
3. Add redirects from old routes
4. Test full flows end-to-end

**Total estimate: 30-38 hours across 9 phases**

---

## 13. Test Scenarios

### Data Model
1. Existing Contact data migrated to Student correctly ✓
2. DripProgress + CampaignProgress relinked to Student ✓
3. Campaign sending works against Student table ✓
4. Unsubscribe flow works against Student ✓
5. Newsletter signup creates Student (not Contact) ✓

### Admin Client List
6. Filter tabs show correct counts ✓
7. Search finds by name and email ✓
8. Status badges display correctly ✓

### Admin Profile
9. All 8 tabs render with correct data ✓
10. Insights calculated correctly from bookings ✓
11. Insights flags trigger (credit expiry, engagement gap, high cancel rate) ✓
12. Assessment editable by admin with `lastEditedBy: "admin"` ✓
13. Commitment audit trail shows all versions ✓
14. Communications tab shows drip/campaign/email history ✓
15. Tag management works ✓

### Onboarding (New Client)
16. Book free consultation → portal welcome email with temp password ✓
17. Login → set password → see onboarding (0 of 3) ✓
18. Complete step 1 (details) → progress updates ✓
19. Roxanne pre-fills assessment → client sees pre-filled items with indicator ✓
20. Complete step 2 (assessment) → toggle chips save ✓
21. Complete step 3 (commitment) → IP + user agent captured ✓
22. Try to book paid session without commitment → blocked ✓

### Booking Management
23. Book new session using credit → credit deducted ✓
24. Join Teams link only visible on session day ✓

### Reschedule Policy
25. Reschedule 3 days out → allowed ✓
26. Reschedule 12 hours out → blocked (under 24hr) ✓
27. Reschedule twice → second allowed ✓
28. Third reschedule attempt → blocked (max 2) ✓

### Cancel Policy
29. Cancel 3 days out → credit refunded ✓
30. Cancel 12 hours out → late cancel warning, credit forfeited ✓

### Anti-Abuse
31. Session tomorrow → reschedule to next week (24hr+ notice — allowed) ✓
32. Cancel rescheduled session → LATE CANCEL (original was within 48hr) ✓
33. Anti-abuse dialog shown with no reschedule option ✓

### Migration
34. Import existing contact as client → welcome email → set password → commitment only → access ✓
35. Migrated client profile + assessment available but not required ✓

### Admin Overrides
36. Roxanne cancels with credit refund override ✓
37. Roxanne marks no-show → credit forfeited ✓
38. Roxanne pre-fills intake during consultation ✓
39. Roxanne converts potential → active with credits ✓

### Portal
40. Client sees all pages (profile, sessions, purchases, credits, preferences, commitment) ✓
41. Client does NOT see behavioural insights ✓
42. Communication preferences save and work correctly ✓