# Life Therapy — Billing & Invoicing Build Plan

> **For Claude Code** — execute each session in order. Each session is a standalone unit with clear inputs, outputs, and verification steps.
>
> **Project root:** The Life Therapy Next.js project
> **Stack:** Next.js 14+ (App Router), Prisma, Supabase, Paystack, Resend
> **Reference:** Read `LT_UNIVERSAL_INVOICING_SYSTEM.md` for the full specification before starting any session.

---

## Pre-Build Checklist

Before starting Session 1, confirm you understand:

- [ ] The project uses Prisma with PostgreSQL (Supabase). Generator output is `../lib/generated/prisma`
- [ ] `SiteSetting` is a **single-row model** with typed columns (NOT key-value). New finance settings go as new columns on this model
- [ ] The project currently uses **Stripe** for payments (`lib/stripe.ts`, `api/webhooks/stripe/route.ts`). Stripe is no longer available for SA — it redirects to Paystack. Paystack integration needs to **replace** Stripe. This is a prerequisite or parallel workstream — the billing system hooks into whichever payment webhook exists. If Paystack isn't integrated yet, build the invoice creation hook into the Stripe webhook for now and migrate when Paystack replaces it
- [ ] **All transactions are ZAR.** Paystack SA only charges in ZAR. International display prices (USD/EUR/GBP) on courses/packages are reference only — checkout is always ZAR. Invoices are always ZAR
- [ ] The admin sidebar is in `components/admin/admin-sidebar.tsx` with role-based nav groups
- [ ] Email system uses `lib/email.ts` (Resend), `lib/email-render.ts`, `lib/email-template-defaults.ts`, and DB-stored `EmailTemplate` model
- [ ] WhatsApp integration does NOT exist yet — `lib/whatsapp.ts` and SA holidays lib need to be built (separate feature, referenced but not built here)
- [ ] Vercel free tier allows only **1 cron** path — but the project currently has 5 cron paths in `vercel.json`. Confirm with user whether they're on Pro or need to combine crons
- [ ] The `Booking` model exists with `SessionType` enum (`free_consultation`, `individual`, `couples`) and `BookingStatus` enum
- [ ] The `Student` model is the client model (not `User`). It has `email`, `firstName`, `lastName`, existing credit system via `SessionCreditBalance` and `SessionCreditTransaction`
- [ ] The `Order` model exists for e-commerce purchases with `OrderItem` children

---

## Session 1 — Schema & Migration

**Goal:** Add all new Prisma models and columns. Run migration. No business logic yet.

### 1.1 Add columns to `Student` model

In `prisma/schema.prisma`, add to the Student model:

```prisma
  // Billing
  billingType            String     @default("prepaid")   // "prepaid" | "postpaid"
  billingEmail           String?                          // Overrides email for invoice delivery
  billingAddress         String?    @db.Text              // Shown on invoice
  standingDiscountPercent Float?                          // e.g. 10.0 for 10% off
  standingDiscountFixed   Int?                            // Fixed discount in cents per line item
```

### 1.2 Add columns to `Booking` model

```prisma
  // Invoicing links
  invoiceId              String?
  invoice                Invoice?  @relation(fields: [invoiceId], references: [id], onDelete: SetNull)
  paymentRequestId       String?
  billingNote            String?   // "(no-show)" | "(rescheduled)" | "(cancelled)" | null
```

Add `@@index([invoiceId])` and `@@index([paymentRequestId])`.

### 1.3 Add columns to `SiteSetting` model

Add these columns after the existing session pricing columns:

```prisma
  // Finance / Invoice settings
  businessRegistrationNumber String?  @default("2019/570691/07")
  invoicePrefix              String?  @default("LT")
  vatRegistered              Boolean  @default(false)
  vatNumber                  String?
  vatPercent                 Float    @default(15)
  bankName                   String?
  bankAccountHolder          String?
  bankAccountNumber          String?
  bankBranchCode             String?
  postpaidBillingDay         Int      @default(20)
  postpaidDueDay             Int      @default(28)
  businessAddress            String?  @db.Text
```

### 1.4 Create `InvoiceSequence` model

```prisma
model InvoiceSequence {
  id         String @id @default("global")
  nextNumber Int    @default(1)

  @@map("invoice_sequences")
}
```

### 1.5 Create `BillingEntity` model

```prisma
model BillingEntity {
  id               String    @id @default(cuid())
  name             String
  contactPerson    String?
  email            String
  phone            String?
  vatNumber        String?
  address          String?   @db.Text
  accountReference String?

  relationships    ClientRelationship[]
  invoices         Invoice[]
  paymentRequests  PaymentRequest[]

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  @@map("billing_entities")
}
```

### 1.6 Create `ClientRelationship` model

```prisma
model ClientRelationship {
  id                 String          @id @default(cuid())
  studentId          String
  student            Student         @relation("RelationshipsFrom", fields: [studentId], references: [id], onDelete: Cascade)
  relatedStudentId   String?
  relatedStudent     Student?        @relation("RelationshipsTo", fields: [relatedStudentId], references: [id], onDelete: Cascade)
  billingEntityId    String?
  billingEntity      BillingEntity?  @relation(fields: [billingEntityId], references: [id], onDelete: Cascade)
  relationshipType   String          // "partner" | "parent" | "child" | "sibling" | "guardian" | "corporate" | "other"
  relationshipLabel  String?
  isBillingLink      Boolean         @default(false)

  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  @@unique([studentId, relatedStudentId])
  @@index([studentId])
  @@index([relatedStudentId])
  @@index([billingEntityId])
  @@map("client_relationships")
}
```

Add relations on `Student`:
```prisma
  relationshipsFrom      ClientRelationship[] @relation("RelationshipsFrom")
  relationshipsTo        ClientRelationship[] @relation("RelationshipsTo")
```

### 1.7 Create `Invoice` model

```prisma
model Invoice {
  id                 String          @id @default(cuid())
  invoiceNumber      String          @unique
  type               String          // "monthly_postpaid" | "package_purchase" | "course_purchase" | "product_sale" | "ad_hoc_session" | "credit_note" | "other"

  // Billing contact
  studentId          String?
  student            Student?        @relation(fields: [studentId], references: [id], onDelete: SetNull)
  billingEntityId    String?
  billingEntity      BillingEntity?  @relation(fields: [billingEntityId], references: [id], onDelete: SetNull)

  // Snapshot at invoice time
  billingName        String
  billingEmail       String
  billingAddress     String?
  billingVatNumber   String?

  // Billing period (postpaid only)
  periodStart        DateTime?
  periodEnd          DateTime?
  billingMonth       String?

  // Financials
  currency           String          @default("ZAR")
  subtotalCents      Int
  discountCents      Int             @default(0)
  discountPercent    Float           @default(0)
  vatPercent         Float           @default(0)
  vatAmountCents     Int             @default(0)
  totalCents         Int

  lineItems          Json            // InvoiceLineItem[]

  // Payment
  status             String          @default("draft") // "draft" | "payment_requested" | "paid" | "overdue" | "cancelled" | "credited"
  paymentMethod      String?         // "paystack" | "stripe" | "eft" | "cash" | "card"
  paystackReference  String?
  stripeReference    String?
  paymentUrl         String?
  paidAt             DateTime?
  paidAmountCents    Int?
  eftReference       String?

  // Source links
  orderId            String?
  paymentRequestId   String?
  creditNoteId       String?

  // PDF
  pdfUrl             String?

  // Dates
  issuedAt           DateTime?
  dueDate            DateTime?

  // Reminder tracking
  reminderSentAt     DateTime?
  overdueSentAt      DateTime?

  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  bookings           Booking[]

  @@index([studentId])
  @@index([billingEntityId])
  @@index([status])
  @@index([type])
  @@index([billingMonth])
  @@map("invoices")
}
```

Add relation on `Student`:
```prisma
  invoices               Invoice[]
```

### 1.8 Create `PaymentRequest` model

```prisma
model PaymentRequest {
  id                 String          @id @default(cuid())
  studentId          String?
  student            Student?        @relation(fields: [studentId], references: [id], onDelete: SetNull)
  billingEntityId    String?
  billingEntity      BillingEntity?  @relation(fields: [billingEntityId], references: [id], onDelete: SetNull)

  billingMonth       String
  periodStart        DateTime
  periodEnd          DateTime

  currency           String          @default("ZAR")
  subtotalCents      Int
  discountCents      Int             @default(0)
  vatAmountCents     Int             @default(0)
  totalCents         Int
  lineItems          Json

  paystackReference  String?
  paymentUrl         String?
  status             String          @default("pending") // "pending" | "paid" | "overdue" | "cancelled"

  dueDate            DateTime

  sentAt             DateTime?
  reminderSentAt     DateTime?
  overdueSentAt      DateTime?

  invoiceId          String?

  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  bookings           Booking[]

  @@unique([studentId, billingMonth])
  @@unique([billingEntityId, billingMonth])
  @@index([status])
  @@index([dueDate])
  @@map("payment_requests")
}
```

Add relation on `Student`:
```prisma
  paymentRequests        PaymentRequest[]
```

### 1.9 Run migration

```bash
npx prisma migrate dev --name add-billing-invoicing-system
```

### 1.10 Seed InvoiceSequence

Create a seed script or add to existing migration SQL:

```sql
INSERT INTO "invoice_sequences" ("id", "nextNumber") VALUES ('global', 1) ON CONFLICT DO NOTHING;
```

### 1.11 Seed SiteSetting finance defaults

Update the existing SiteSetting row (or create if doesn't exist) with finance defaults:

```sql
UPDATE "site_settings" SET
  "businessRegistrationNumber" = '2019/570691/07',
  "invoicePrefix" = 'LT',
  "vatRegistered" = false,
  "vatPercent" = 15,
  "bankName" = 'Standard Bank',
  "bankAccountHolder" = 'Life Therapy',
  "bankAccountNumber" = '10 19 117 888 0',
  "bankBranchCode" = '050 210 Paarl',
  "postpaidBillingDay" = 20,
  "postpaidDueDay" = 28,
  "businessAddress" = '13 Station Street, Unit 2, Blue House, Paarl, 7646'
WHERE id = (SELECT id FROM "site_settings" LIMIT 1);
```

### Verify

- [ ] `npx prisma migrate dev` succeeds
- [ ] `npx prisma generate` succeeds
- [ ] New models appear in `lib/generated/prisma`
- [ ] Existing functionality not broken (quick smoke test: admin dashboard loads, booking page loads)
- [ ] `InvoiceSequence` row exists with nextNumber = 1

---

## Session 2 — Core Billing Library

**Goal:** Build the foundational libs that everything else depends on. Pure functions, no UI.

### 2.1 Create `lib/sa-holidays.ts`

SA public holidays for date shifting. Include fixed holidays + dynamic ones (Good Friday, Family Day, Easter Monday). Cover 2026-2030 at minimum.

```typescript
export function getSAPublicHolidays(year: number): Date[]
export function isWeekend(date: Date): boolean
export function isSAPublicHoliday(date: Date): boolean
export function isBusinessDay(date: Date): boolean
export function getPrecedingBusinessDay(date: Date): Date
export function getNextBusinessDay(date: Date): Date
export function addBusinessDays(date: Date, days: number): Date
export function subtractBusinessDays(date: Date, days: number): Date
```

Key SA holidays: New Year's (1 Jan), Human Rights Day (21 Mar), Good Friday (dynamic), Family Day (dynamic), Freedom Day (27 Apr), Workers' Day (1 May), Youth Day (16 Jun), National Women's Day (9 Aug), Heritage Day (24 Sep), Day of Reconciliation (16 Dec), Christmas (25 Dec), Day of Goodwill (26 Dec). If holiday falls on Sunday, Monday becomes holiday.

### 2.2 Create `lib/invoice-numbering.ts`

Atomic sequence counter + number formatting.

```typescript
import { prisma } from "@/lib/prisma";

export async function getNextInvoiceNumber(
  billingName: string,
  prefix: string,
  date: Date
): Promise<{ number: string; sequence: number }> {
  // Use transaction for atomicity
  // Format: YYYYMMDD-{PREFIX}-{INITIALS}-{SEQUENCE}
  // Initials: first letter of first word + first letter of last word, uppercase
  // Sequence: 5-digit zero-padded, never resets
}

export function formatInvoiceNumber(
  date: Date,
  prefix: string,
  initials: string,
  sequence: number
): string {
  // e.g. "20260220-LT-GS-00001"
}

export function extractInitials(name: string): string {
  // "Genna Scott" → "GS"
  // "ABC Corp Employee Wellness" → "AC"
  // "John" → "JO" (first 2 letters if single word)
}
```

### 2.3 Create `lib/billing.ts`

Date utilities and VAT/discount calculation.

```typescript
import { getSiteSettings } from "@/lib/settings";
import { getPrecedingBusinessDay, subtractBusinessDays, getNextBusinessDay } from "@/lib/sa-holidays";

// --- Date utilities ---

export function getEffectiveBillingDate(year: number, month: number, billingDay: number): Date
// Returns the billing day, shifted to preceding business day if weekend/holiday

export function getEffectiveDueDate(year: number, month: number, dueDay: number): Date
// Returns the due day, shifted to preceding business day if weekend/holiday

export function getReminderDate(dueDate: Date): Date
// 2 business days before due date

export function getOverdueDate(dueDate: Date): Date
// 1 business day after due date

export function getBillingPeriod(year: number, month: number, billingDay: number): { start: Date; end: Date }
// For month M with billing day D:
// Start: day after previous month's billing date
// End: this month's billing date

// --- Financial calculations ---

export interface LineItemCalc {
  unitPriceCents: number;
  quantity: number;
  lineDiscountPercent?: number;
  lineDiscountCents?: number;
}

export function calculateLineTotal(item: LineItemCalc): { gross: number; discount: number; net: number }
// gross = unitPrice × quantity
// discount = max of (gross × percent / 100, fixedCents)
// net = gross - discount

export function calculateInvoiceTotals(
  lineItems: LineItemCalc[],
  invoiceDiscountPercent?: number,
  invoiceDiscountCents?: number,
  vatRegistered?: boolean,
  vatPercent?: number
): {
  subtotalCents: number;
  discountCents: number;
  vatAmountCents: number;
  totalCents: number;
}

// --- Rate lookup ---

export type SessionRateKey = "individual" | "couples" | "free_consultation";

export async function getSessionRate(
  sessionType: SessionRateKey,
  currency?: string
): Promise<number>
// Reads from SiteSetting columns. Returns ex-VAT cents.

// --- Billing contact resolution ---

export interface BillingContact {
  type: "self" | "individual" | "corporate";
  studentId?: string;
  billingEntityId?: string;
  name: string;
  email: string;
  address?: string;
  vatNumber?: string;
}

export async function resolveBillingContact(studentId: string): Promise<BillingContact>
// 1. Check for corporate billing link (isBillingLink + billingEntityId)
// 2. Check for individual billing link (isBillingLink + relatedStudentId)
// 3. Default: student pays for themselves
```

### 2.4 Create `lib/billing-types.ts`

Shared TypeScript interfaces.

```typescript
export interface InvoiceLineItem {
  description: string;
  subLine?: string;
  quantity: number;
  unitPriceCents: number;
  discountCents: number;
  discountPercent: number;
  totalCents: number;
  bookingId?: string;
  productId?: string;
  courseId?: string;
  orderId?: string;
  attendeeName?: string;
  billingNote?: string;
}
```

### Verify

- [ ] `lib/sa-holidays.ts` — unit test: `isBusinessDay(new Date('2026-12-25'))` returns false, `getPrecedingBusinessDay(new Date('2026-12-25'))` returns 24 Dec (Thursday), `isBusinessDay(new Date('2026-03-21'))` returns false (Human Rights Day)
- [ ] `lib/invoice-numbering.ts` — `extractInitials("Genna Scott")` returns "GS", `extractInitials("ABC Corp")` returns "AC"
- [ ] `lib/billing.ts` — `calculateInvoiceTotals` with 2 items at R895 each, no discount, no VAT = subtotal 179000, total 179000. With 15% VAT = total 205850
- [ ] `resolveBillingContact` returns self when no relationships exist

---

## Session 3 — Invoice PDF Generation

**Goal:** Generate PDF invoices matching Roxanne's template exactly.

### 3.1 Install dependencies

```bash
npm install jspdf
```

Or if preferring a different approach, `@react-pdf/renderer` — but jsPDF is simpler for server-side generation. Check which is already in the project. If neither, use jsPDF.

### 3.2 Create `lib/generate-invoice-pdf.ts`

Generate a PDF matching the template layout from the spec. Key sections:

1. **Header:** "Tax Invoice" (or "Invoice" if not VAT registered) top-left, Life Therapy logo top-right
2. **Business details block:** Left side — business name, VAT no (only if registered), address
3. **Invoice meta block:** Right side — Number, Date, Page, Reference (initials + prefix), Due Date, Overall Discount %
4. **Client details:** Name, Customer VAT No (only if registered), address
5. **Line items table:** Description, Quantity, Excl. Price, Total — with sub-lines for session date/time and billing notes
6. **Footer left:** Banking details (bank, account holder, account number, branch, reg number)
7. **Footer right:** Totals stack — Total Discount, Total Exclusive, Total VAT (only if registered), Total

```typescript
export async function generateInvoicePDF(invoiceId: string): Promise<Buffer>
// Fetches invoice from DB, generates PDF, returns Buffer

export async function generateAndStoreInvoicePDF(invoiceId: string): Promise<string>
// Generates PDF, uploads to Supabase Storage (invoices/{invoiceId}.pdf), updates invoice.pdfUrl, returns URL
```

### 3.3 Create Supabase Storage bucket

Either via Supabase dashboard or migration:
- Bucket name: `invoices`
- Public: false (access via signed URLs or server-side)

### 3.4 Currency formatting helper

Ensure `lib/utils.ts` has or extend `formatPrice` to handle R, $, £, € symbols correctly for invoice display.

### Verify

- [ ] Generate a test PDF with sample data (2 individual sessions, 1 couples session, 1 no-show annotation)
- [ ] PDF opens correctly and matches the template layout
- [ ] VAT toggle off: no VAT number shown, no VAT line in totals
- [ ] VAT toggle on: VAT number shown, VAT line in totals
- [ ] Banking details shown at bottom-left
- [ ] Logo renders top-right
- [ ] Sub-lines (session dates, billing notes) render correctly
- [ ] Multi-page: test with 15+ line items to verify page break handling

---

## Session 4 — Invoice Creation Engine

**Goal:** Build the core function that creates invoices from any payment source.

### 4.1 Create `lib/create-invoice.ts`

```typescript
// Creates an invoice from a completed Paystack/Stripe payment
export async function createInvoiceFromPayment(params: {
  type: string;
  studentId: string;
  orderId?: string;
  amountCents: number;
  currency: string;
  paymentReference: string;
  paymentMethod: "paystack" | "stripe" | "eft" | "cash" | "card";
  lineItems: InvoiceLineItem[];
  metadata?: Record<string, unknown>;
}): Promise<Invoice>

// Creates an invoice from a paid payment request (postpaid)
export async function createInvoiceFromPaymentRequest(
  paymentRequestId: string,
  payment: {
    reference: string;
    method: "paystack" | "stripe" | "eft" | "cash" | "card";
    amountCents: number;
  }
): Promise<Invoice>

// Creates an invoice for admin "mark as paid" (EFT/cash)
export async function createManualInvoice(params: {
  type: string;
  studentId?: string;
  billingEntityId?: string;
  lineItems: InvoiceLineItem[];
  paymentMethod: "eft" | "cash" | "card";
  paymentReference?: string;
  currency?: string;
}): Promise<Invoice>
```

All functions:
1. Resolve billing contact
2. Get next invoice number (atomic)
3. Calculate totals (with discounts + VAT)
4. Create Invoice record
5. Generate PDF
6. Return the invoice

### 4.2 Create `lib/generate-payment-requests.ts`

For monthly postpaid billing cycle.

```typescript
export async function generateMonthlyPaymentRequests(
  billingDate: Date
): Promise<PaymentRequest[]>
// 1. Get all postpaid students
// 2. Group by billing contact (via resolveBillingContact)
// 3. For each group:
//    a. Get completed bookings in billing period that aren't already on a payment request
//    b. Skip if zero sessions
//    c. Build line items with session details + billing notes
//    d. Apply standing discounts
//    e. Calculate totals
//    f. Create PaymentRequest record
//    g. Generate Paystack payment link (or stub for now)
// 4. Return all created payment requests

export async function getUnbilledBookings(
  studentId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Booking[]>
// Completed bookings not linked to any paymentRequest or invoice
```

### 4.3 Integrate with existing webhook

**EDIT** `app/api/webhooks/stripe/route.ts` (or the Paystack equivalent when built):

After `processCheckoutCompleted(orderId)` succeeds, add:

```typescript
// Generate invoice for this payment
try {
  const invoice = await createInvoiceFromPayment({
    type: determineInvoiceType(order), // map order items to invoice type
    studentId: order.studentId,
    orderId: order.id,
    amountCents: order.totalCents,
    currency: order.currency,
    paymentReference: session.payment_intent || session.id,
    paymentMethod: "stripe",
    lineItems: buildLineItemsFromOrder(order),
  });
  // Send invoice email
  await sendInvoiceEmail(invoice.id);
} catch (err) {
  console.error("Failed to create invoice:", err);
  // Don't fail the webhook — invoice can be generated manually
}
```

Create helper: `determineInvoiceType(order)` — checks order items to return "course_purchase", "package_purchase", "product_sale", etc.

Create helper: `buildLineItemsFromOrder(order)` — converts OrderItem[] to InvoiceLineItem[].

### Verify

- [ ] `createInvoiceFromPayment` creates invoice with correct number (00001), PDF generated, stored
- [ ] Second call creates 00002 (atomic increment works)
- [ ] `createInvoiceFromPaymentRequest` creates invoice from existing payment request data
- [ ] `generateMonthlyPaymentRequests` with 3 postpaid clients each with 2 sessions → 3 payment requests created
- [ ] Consolidated billing: parent linked to 2 children → 1 payment request with all sessions
- [ ] Zero sessions → no payment request created (skipped)
- [ ] Standing discount applied correctly on line items
- [ ] Webhook integration doesn't break existing order flow

---

## Session 5 — Invoice Email Delivery

**Goal:** Send invoice emails with PDF attachment and payment request emails.

### 5.1 Add email templates to `lib/email-template-defaults.ts`

Add 4 new templates:

1. **`invoice`** — sent with every paid invoice (all types)
   - Subject: "Life Therapy Invoice {{invoiceNumber}}"
   - Body: Greeting, summary, "Your invoice is attached", PDF attached

2. **`payment_request`** — sent to postpaid clients on billing date
   - Subject: "Your Life Therapy sessions for {{month}}"
   - Body: Session summary, total, due date, prominent "Pay Now" button (Paystack link)

3. **`payment_request_reminder`** — 2 business days before due
   - Subject: "Friendly reminder — payment due {{dueDate}}"
   - Body: Short reminder with amount and Pay Now button

4. **`payment_request_overdue`** — 1 business day after due
   - Subject: "Payment overdue — Life Therapy {{month}}"
   - Body: Overdue notice with amount and Pay Now button

### 5.2 Add template renderers to `lib/email-render.ts`

Add cases for the 4 new template keys. Follow existing pattern.

### 5.3 Seed templates to DB

Add migration SQL or script to insert the 4 new EmailTemplate rows (key, name, category "billing", subject, bodyHtml, variables).

### 5.4 Create `lib/send-invoice.ts`

```typescript
export async function sendInvoiceEmail(invoiceId: string): Promise<void>
// 1. Fetch invoice with PDF URL
// 2. Download PDF from Supabase Storage
// 3. Render email template
// 4. Send via Resend with PDF attachment
// 5. Log to EmailLog

export async function sendPaymentRequestEmail(paymentRequestId: string): Promise<void>
// 1. Fetch payment request
// 2. Render template with line items summary + payment URL
// 3. Send via Resend
// 4. Update sentAt
// 5. Log to EmailLog

export async function sendPaymentReminder(paymentRequestId: string): Promise<void>
// Friendly reminder email. Update reminderSentAt.

export async function sendOverdueNotice(paymentRequestId: string): Promise<void>
// Overdue notice email. Update overdueSentAt. Set status to "overdue".
```

### 5.5 Check Resend attachment support

Confirm `lib/email.ts` `sendEmail` function supports attachments. If not, extend it:

```typescript
interface SendEmailParams {
  // ... existing
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}
```

### Verify

- [ ] Invoice email sends with PDF attached
- [ ] Payment request email sends with session summary and pay link
- [ ] Reminder email renders correctly
- [ ] Overdue email renders correctly
- [ ] All 4 templates appear in admin Email Templates page
- [ ] EmailLog entries created for each send

---

## Session 6 — Monthly Billing Cron

**Goal:** Automated daily cron that handles billing, reminders, and overdue notices.

### 6.1 Create `app/api/cron/monthly-billing/route.ts`

Daily cron job. On each run:

```typescript
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const today = new Date(); // In SAST (Africa/Johannesburg)
  const settings = await getSiteSettings();

  // 1. CHECK: Is today the effective billing date for this month?
  const billingDate = getEffectiveBillingDate(today.getFullYear(), today.getMonth(), settings.postpaidBillingDay);
  if (isSameDay(today, billingDate)) {
    const requests = await generateMonthlyPaymentRequests(billingDate);
    for (const req of requests) {
      await sendPaymentRequestEmail(req.id);
    }
    console.log(`Generated ${requests.length} payment requests`);
  }

  // 2. CHECK: Is today the reminder date for any unpaid requests?
  const unpaidRequests = await getUnpaidPaymentRequests();
  for (const req of unpaidRequests) {
    const reminderDate = getReminderDate(req.dueDate);
    if (isSameDay(today, reminderDate) && !req.reminderSentAt) {
      await sendPaymentReminder(req.id);
    }
  }

  // 3. CHECK: Is today the overdue date for any unpaid requests?
  for (const req of unpaidRequests) {
    const overdueDate = getOverdueDate(req.dueDate);
    if (isSameDay(today, overdueDate) && !req.overdueSentAt) {
      await sendOverdueNotice(req.id);
    }
  }

  return Response.json({ ok: true });
}
```

### 6.2 Update `vercel.json`

Add the new cron. Run at 06:00 SAST (04:00 UTC) daily:

```json
{
  "path": "/api/cron/monthly-billing",
  "schedule": "0 4 * * *"
}
```

**Note:** If on Vercel free tier (1 cron only), discuss with user about combining into a single dispatcher cron that calls all sub-functions. Otherwise add as 6th cron.

### 6.3 Timezone handling

All date comparisons must use SAST (UTC+2). Use `date-fns-tz` or manual offset:

```typescript
function getSASTToday(): Date {
  const now = new Date();
  // Convert to SAST
  const sast = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  return startOfDay(sast);
}
```

### Verify

- [ ] On billing day: payment requests generated for all postpaid clients with unbilled sessions
- [ ] On billing day with zero sessions: no payment request generated
- [ ] 2 business days before due: reminder sent for unpaid requests only
- [ ] Reminder not sent twice (check reminderSentAt)
- [ ] 1 business day after due: overdue notice sent, status updated
- [ ] Weekend/holiday shifting works: billing day on Saturday → runs on Friday
- [ ] Cron auth header check works (rejects without secret)

---

## Session 7 — Admin Finance Settings

**Goal:** Finance configuration page in admin settings.

### 7.1 Create `app/(admin)/admin/(dashboard)/settings/finance/page.tsx`

Full settings page with 5 sections. Use existing settings page patterns from `app/(admin)/admin/(dashboard)/settings/`.

**Section 1: Business Details**
- Business name (from existing `siteName`)
- Business address (textarea, new `businessAddress` column)
- Company registration number (`businessRegistrationNumber`)
- Invoice prefix (`invoicePrefix`)

**Section 2: VAT Configuration**
- VAT registered toggle (`vatRegistered`)
- VAT number (text, visible only when toggle on)
- VAT rate % (`vatPercent`)
- Live preview: shows sample invoice calculation with/without VAT

**Section 3: Session Rates**
- Individual rate (currency input) — uses existing `sessionPriceIndividualZar`
- Couples rate — uses existing `sessionPriceCouplesZar`
- Consultation rate (fixed R0, display only)
- Preview showing client price with/without VAT

**Section 4: Monthly Billing Schedule**
- Billing day picker (1-28)
- Due day picker (1-28)
- Validation: due day must be after billing day
- Smart preview showing next billing date with weekend/holiday shift

**Section 5: Banking Details**
- Bank name, account holder, account number, branch code

### 7.2 Create `app/(admin)/admin/(dashboard)/settings/finance/actions.ts`

Server actions:

```typescript
"use server";

export async function updateFinanceSettingsAction(formData: FormData)
// Validates and updates SiteSetting columns
// Returns { success: true } or { error: "..." }
```

### 7.3 Add navigation

**EDIT** `components/admin/admin-sidebar.tsx`:

Add to the "Admin" group:

```typescript
{ href: "/admin/settings/finance", label: "Finance", icon: Receipt, roles: ["super_admin"] },
```

Import `Receipt` from lucide-react.

### Verify

- [ ] Finance settings page loads with current values
- [ ] All 5 sections render correctly
- [ ] Save updates all fields
- [ ] VAT toggle shows/hides VAT fields
- [ ] Live preview updates dynamically
- [ ] Billing date preview shows correct next date with shift

---

## Session 8 — Admin Client Billing & Relationships

**Goal:** Add billing configuration and relationship management to the client profile.

### 8.1 Add Relationships tab to client profile

**EDIT** `app/(admin)/admin/(dashboard)/clients/[id]/tabs/` — create `relationships-tab.tsx`

Shows:
- List of linked clients/entities with relationship type and billing link indicator
- "Add Relationship" button → dialog:
  - Search/select client (existing student search)
  - Or "Add Corporate Entity" option
  - Relationship type dropdown
  - Label (free text)
  - "This person/entity pays for [client]'s sessions" toggle
- Edit/remove relationships
- For partners: "Available for couples booking" implied by type

### 8.2 Update Finances tab

**EDIT** `app/(admin)/admin/(dashboard)/clients/[id]/tabs/finances-tab.tsx`

Add at the top:
- **Billing Type** badge (Prepaid/Postpaid) with toggle button
- **Billing Email** (editable, defaults to client email)
- **Standing Discount** inputs (% and/or fixed amount)
- **"Bill to Date"** button (visible when switching billing type)

Add at the bottom or as sub-section:
- **Invoice History** table: all invoices for this client
  - Columns: Number, Date, Type, Amount, Status
  - Actions: Download PDF, Resend, Mark as Paid, Void
- **Payment Requests** table (for postpaid clients)
  - Columns: Month, Amount, Status, Due Date
  - Actions: Resend, Mark as Paid

### 8.3 Create actions

**EDIT** `app/(admin)/admin/(dashboard)/clients/[id]/actions.ts` — add:

```typescript
export async function updateBillingTypeAction(studentId: string, billingType: string)
export async function updateBillingEmailAction(studentId: string, email: string)
export async function updateStandingDiscountAction(studentId: string, percent?: number, fixed?: number)
export async function addRelationshipAction(data: { studentId, relatedStudentId?, billingEntityId?, type, label?, isBillingLink })
export async function removeRelationshipAction(relationshipId: string)
export async function markInvoicePaidAction(invoiceId: string, method: string, reference?: string)
export async function voidInvoiceAction(invoiceId: string)
export async function resendInvoiceAction(invoiceId: string)
export async function billToDateAction(studentId: string)
```

### 8.4 Add tab to profile tabs component

**EDIT** `app/(admin)/admin/(dashboard)/clients/[id]/client-profile-tabs.tsx` — add "Relationships" tab.

### 8.5 Create `BillingEntity` CRUD

Simple admin page or dialog for creating/editing corporate billing entities.

If full page: `app/(admin)/admin/(dashboard)/billing-entities/page.tsx`
Or inline dialog within the relationships tab.

### Verify

- [ ] Relationships tab shows linked clients and entities
- [ ] Add relationship dialog works (client search, type, billing link)
- [ ] Billing type toggle switches prepaid ↔ postpaid
- [ ] Standing discount saved and reflected
- [ ] Invoice history shows all client invoices
- [ ] Mark as paid works (status updates, payment method stored)
- [ ] Void removes invoice (status → cancelled, unlinks bookings)
- [ ] Bill to date generates payment request for unbilled sessions

---

## Session 9 — Admin Invoice Management Page

**Goal:** Central invoice management with filters, actions, and accountant export.

### 9.1 Create `app/(admin)/admin/(dashboard)/invoices/page.tsx`

Full invoice list page:

**Summary cards at top:**
- Total invoices this month
- Total paid this month (sum of totalCents)
- Total outstanding (unpaid)
- Total overdue

**Filter bar:**
- Type dropdown: All, Monthly Postpaid, Package, Course, Product, Other
- Status dropdown: All, Draft, Payment Requested, Paid, Overdue, Cancelled
- Month/Year picker
- Client search
- Billing contact search

**Table columns:**
- Invoice Number (link to detail)
- Date
- Client / Billing Contact
- Type (badge)
- Amount (formatted with currency)
- Status (badge: green=paid, yellow=pending, red=overdue, gray=cancelled)
- Actions dropdown: Download PDF, Resend, Mark as Paid, Void

**Accountant Export button:**
- Opens dialog with:
  - Financial year dropdown (FY2026 = 1 Mar 2025 – 28 Feb 2026)
  - OR custom date range
  - Type filter
  - Status filter
- Exports CSV with columns: Invoice Number, Date, Client, Billing Contact, Type, Description, Currency, Subtotal, Discount, VAT, Total, Payment Method, Payment Date, Reference

### 9.2 Create `app/(admin)/admin/(dashboard)/invoices/actions.ts`

```typescript
"use server";

export async function getInvoicesAction(filters: InvoiceFilters)
export async function exportInvoicesCsvAction(filters: ExportFilters): Promise<string>
// Returns CSV content string
```

### 9.3 Add to sidebar

**EDIT** `components/admin/admin-sidebar.tsx`:

Add to the "E-Commerce" group (or create "Finance" group):

```typescript
{ href: "/admin/invoices", label: "Invoices", icon: FileText, roles: ["super_admin"] },
```

### Verify

- [ ] Invoice list loads with all invoices
- [ ] Filters work correctly (type, status, month, client)
- [ ] Summary cards show correct totals
- [ ] Actions work: download PDF, resend, mark as paid, void
- [ ] CSV export produces correct file with all columns
- [ ] Financial year filter works (March to February)
- [ ] Sidebar link appears and navigates correctly

---

## Session 10 — Portal Invoice View

**Goal:** Client-facing invoice history and payment.

### 10.1 Create `app/(portal)/portal/(dashboard)/invoices/page.tsx`

Portal page showing client's invoice history.

**For all clients:**
- Invoice list: Date, Number, Type, Amount, Status badge
- "Download PDF" button for paid invoices
- Filter by year

**For postpaid clients (additional):**
- Current month's completed sessions (preview of what will be billed)
- Pending payment request card with:
  - Session summary
  - Total amount
  - Due date
  - "Pay Now" button (links to Paystack payment URL)
- Note: "Sessions after [billing date] will appear on next month's statement"

**After payment (Paystack redirect callback):**
- Success page showing invoice number and download link
- This may need a callback route: `app/(portal)/portal/(dashboard)/invoices/payment-success/page.tsx`

### 10.2 Add to portal navigation

**EDIT** `app/(portal)/portal/(dashboard)/layout.tsx` (portal sidebar/nav):

Add "Invoices" link with Receipt icon.

### Verify

- [ ] Client sees their invoice history
- [ ] PDF download works
- [ ] Postpaid client sees pending payment request with Pay Now button
- [ ] Payment success page shows after Paystack redirect
- [ ] Client cannot see other clients' invoices (auth check)

---

## Session 11 — Booking Flow Integration

**Goal:** Wire billing into the booking system — postpaid skip, billing notes, couples flow.

### 11.1 Postpaid clients skip credit check

**EDIT** booking creation actions (check `app/(admin)/admin/(dashboard)/bookings/actions.ts` and `app/(portal)/portal/(dashboard)/bookings/actions.ts`):

When creating/confirming a booking for a postpaid client:
- Skip `SessionCreditBalance` check
- Skip credit deduction on completion
- Session will appear on next billing cycle's payment request

```typescript
const student = await prisma.student.findUnique({ where: { id: studentId } });
if (student.billingType === "postpaid") {
  // Skip credit check — session will be invoiced monthly
} else {
  // Existing credit check/deduction logic
}
```

### 11.2 Billing notes on status changes

When booking status changes to cancelled/no-show/rescheduled, set `billingNote`:

**EDIT** booking status change actions:

```typescript
// On cancel
await prisma.booking.update({
  where: { id: bookingId },
  data: {
    status: "cancelled",
    billingNote: "(cancelled)",
    // ... existing cancel logic
  }
});

// On no-show
await prisma.booking.update({
  where: { id: bookingId },
  data: {
    status: "no_show",
    billingNote: "(no-show)",
  }
});

// On reschedule (keep billingNote on original if completed)
// New booking gets no note unless also rescheduled
```

### 11.3 Couples booking enhancement (if time)

**NOTE:** This is a larger UI change. If the current booking dialog doesn't support selecting a second person, this may need its own session. For now, ensure the schema supports it (Booking model can have a note about second attendee).

If implementing:
- Admin create booking dialog: when session type = "couples", show dropdown of linked partners
- Both names stored (clientName field or a new field)
- Line item description: "Couples Session: 90min - Genna & Mark Scott"

### Verify

- [ ] Postpaid client booking: no credit deducted, no credit check
- [ ] Prepaid client booking: credits still checked and deducted (unchanged)
- [ ] Cancelled booking: billingNote = "(cancelled)"
- [ ] No-show booking: billingNote = "(no-show)"
- [ ] Rescheduled booking: billingNote = "(rescheduled)" on original
- [ ] Postpaid client's bookings appear on monthly payment request

---

## Session 12 — Polish & Edge Cases

**Goal:** Handle edge cases, idempotency, error states.

### 12.1 Duplicate payment prevention

In webhook handler, before creating invoice:

```typescript
// Check if invoice already exists for this payment reference
const existing = await prisma.invoice.findFirst({
  where: { paystackReference: event.data.reference }
});
if (existing) {
  console.log(`Invoice already exists for ${event.data.reference}`);
  return; // Idempotent — don't create duplicate
}
```

Same for Stripe:
```typescript
const existing = await prisma.invoice.findFirst({
  where: { stripeReference: session.payment_intent }
});
```

### 12.2 Payment request duplicate prevention

In `generateMonthlyPaymentRequests`, the `@@unique([studentId, billingMonth])` constraint prevents duplicates. Catch the unique constraint error gracefully:

```typescript
try {
  await prisma.paymentRequest.create({ data: { ... } });
} catch (err) {
  if (err.code === 'P2002') {
    console.log(`Payment request already exists for ${studentId} ${billingMonth}`);
    continue;
  }
  throw err;
}
```

### 12.3 Void invoice action

When admin voids an invoice:
1. Set status to "cancelled"
2. Unlink all bookings (set `invoiceId = null`) so they can be re-invoiced
3. If paid, note that a credit note may be needed (future feature)

### 12.4 Regenerate payment link

Admin action to regenerate Paystack link for expired payment requests without creating a new request:

```typescript
export async function regeneratePaymentLinkAction(paymentRequestId: string)
// Creates new Paystack payment link, updates paymentUrl on the request
```

### 12.5 Admin "Generate Invoice" manual action

For ad-hoc invoices (e.g., admin manually invoicing a session):

```typescript
export async function generateAdHocInvoiceAction(params: {
  studentId: string;
  lineItems: InvoiceLineItem[];
  paymentMethod: string;
  reference?: string;
})
```

### 12.6 Currency

All invoices are ZAR. The `currency` field defaults to "ZAR" and is kept for future-proofing but not expected to vary. PDF always shows R symbol. Display prices in USD/EUR/GBP on `life-therapy.online` are for reference only — Paystack checkout is always ZAR.

### Verify

- [ ] Duplicate Paystack webhook → no duplicate invoice
- [ ] Duplicate cron run → no duplicate payment requests
- [ ] Void invoice → status cancelled, bookings unlinked
- [ ] Regenerate payment link → new URL, same payment request
- [ ] Ad-hoc invoice → correct number, PDF generated
- [ ] Currency always ZAR on invoice, R symbol on PDF

---

## Post-Build: Integration Testing Checklist

Run through these end-to-end scenarios:

| # | Scenario | Steps |
|---|----------|-------|
| 1 | **Prepaid purchase → invoice** | Client buys course → Stripe webhook → Invoice created → PDF emailed |
| 2 | **Postpaid monthly cycle** | 3 clients with sessions → cron runs on billing day → 3 payment requests sent |
| 3 | **Postpaid payment** | Client clicks Pay Now → Paystack success → Invoice created → PDF emailed |
| 4 | **Consolidated invoice** | Parent linked to child → both have sessions → 1 payment request to parent |
| 5 | **No-show annotation** | Admin marks no-show → billingNote set → appears on invoice |
| 6 | **Reminder cycle** | Unpaid 2 days before due → reminder sent → still unpaid after due → overdue notice |
| 7 | **Manual payment** | Admin marks invoice as paid (EFT) → status updated |
| 8 | **VAT toggle** | Turn on VAT → new invoices show VAT line → turn off → no VAT |
| 9 | **Standing discount** | Client has 10% → all line items discounted on next invoice |
| 10 | **Bill to date** | Switch prepaid→postpaid → unbilled sessions invoiced |
| 11 | **Accountant export** | Export FY2026 CSV → all invoices sequential, no gaps |
| 12 | **Portal view** | Client sees invoices, downloads PDF, pays pending request |

---

## Future Sessions (Not in This Build)

These are referenced in the spec but deferred:

- **WhatsApp message delivery** — requires Meta Business setup, template approval, and `lib/whatsapp.ts` build (separate feature)
- **Credit note UI** — model exists, UI deferred
- **Couples booking portal flow** — partner selection in portal (needs portal booking redesign)
- **Book on behalf flow** — parent booking for child in portal
- **Paystack integration** — replacing Stripe entirely (Stripe no longer available for SA). Needs its own session: new `lib/paystack.ts`, `api/webhooks/paystack/route.ts`, checkout flow migration, env vars. All charges ZAR only
- **Corporate billing entity admin page** — full CRUD if not built inline in Session 8