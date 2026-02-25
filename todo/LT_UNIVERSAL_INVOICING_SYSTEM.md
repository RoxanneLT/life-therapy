# Life Therapy — Universal Invoicing & Billing System

## Context

Life Therapy needs a comprehensive invoicing system that captures ALL income as proper tax documents. Currently, payments happen through Paystack but no formal invoices are generated. Roxanne manually creates invoices for postpaid clients via a separate tool.

This feature builds a universal invoicing layer that:
- Generates a tax invoice for every successful payment (courses, packages, products, ad-hoc sessions)
- Auto-generates monthly payment requests for postpaid session clients
- Supports client relationships (couples, parent/child, corporate sponsors)
- Produces PDF invoices matching Roxanne's current template
- Handles VAT (future-proofed, currently not registered)
- Supports multi-currency (ZAR via life-therapy.co.za, USD/GBP/EUR via life-therapy.online)

## Core Principle

**Invoice = successful payment received.** The sequential invoice number and PDF are only created when money lands. For postpaid clients, a "payment request" is sent first (with Paystack link), and the official invoice is generated on Paystack confirmation.

---

## Invoice Numbering

**Format:** `YYYYMMDD-LT-{INITIALS}-{SEQUENCE}`

- `YYYYMMDD` — date of invoice creation (= date of payment confirmation)
- `LT` — business prefix (configurable in settings via `invoice_prefix`)
- `{INITIALS}` — first letter of billing contact's firstName + lastName, uppercase. For corporate billing entities: first 2 letters of company name uppercase
- `{SEQUENCE}` — 5-digit zero-padded global counter, never resets, increments across all clients and all invoice types

**Examples:**
- `20260220-LT-GS-00001` — Genna Scott's first invoice
- `20260220-LT-MS-00002` — Mark Scott bought a course same day
- `20260228-LT-GS-00003` — Genna's postpaid monthly sessions
- `20270415-LT-AC-00247` — ABC Corp employee wellness invoice
- `20280101-LT-TS-02841` — still counting, never resets

**Storage:** A single `invoice_sequence` counter in a dedicated table or site_settings, incremented atomically (use Prisma transaction or DB sequence to prevent race conditions on concurrent payments).

---

## Finance & VAT Model

**All rates stored ex-VAT (base rates).** VAT calculated on top when registered.

- `vat_registered` (boolean, default: false) — toggles VAT across all invoices
- `vat_number` (string, optional) — shown on invoice only when registered
- `vat_percent` (number, default: 15) — editable for future-proofing

**Invoice calculation:**
```
subtotal = sum of line items (each at base rate)
discount = sum of line-item discounts + invoice-level discount
vatAmount = vat_registered ? (subtotal - discount) × vat_percent / 100 : 0
total = (subtotal - discount) + vatAmount
```

**When NOT VAT registered (current):** Invoice does not show VAT No field anywhere. No "Total VAT" line in footer. Just: Total Exclusive, Total Discount, Total.

**When VAT registered (future):** VAT No shown in header. Footer shows: Total Exclusive, Total Discount, Total VAT, Total.

Paystack charge = total (inclusive of VAT if applicable).

---

## Session Rates

Stored in site_settings as **ex-VAT cents**:
- `rate_individual_cents` — e.g. 89500 (R895.00)
- `rate_couples_cents` — e.g. 110000 (R1,100.00)
- `rate_consultation_cents` — 0 (free initial consultation)

Session type → rate mapping determined by the `sessionType` enum values. Configurable in Finance settings.

---

## Schema Changes

### Student model — add billing fields

```prisma
  billingType        String     @default("prepaid")   // "prepaid" | "postpaid"
  billingEmail       String?                          // Defaults to email if null
  billingAddress     String?                          // For invoice, can be blank
```

Migration:
```sql
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "billingType" TEXT DEFAULT 'prepaid';
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "billingEmail" TEXT;
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "billingAddress" TEXT;
```

### New model: ClientRelationship

Links clients to each other or to corporate billing entities.

```prisma
model ClientRelationship {
  id                  String    @id @default(cuid())

  // Person A (the one being described)
  studentId           String
  student             Student   @relation("RelationshipsFrom", fields: [studentId], references: [id])

  // Person B (related to) — nullable if linked to corporate entity
  relatedStudentId    String?
  relatedStudent      Student?  @relation("RelationshipsTo", fields: [relatedStudentId], references: [id])

  // Corporate billing entity — nullable if linked to another student
  billingEntityId     String?
  billingEntity       BillingEntity? @relation(fields: [billingEntityId], references: [id])

  // Relationship details
  relationshipType    String    // "partner" | "parent" | "child" | "sibling" | "guardian" | "corporate" | "other"
  relationshipLabel   String?   // Free text: "Mother", "HR Manager", "Husband" etc.

  // Billing
  isBillingLink       Boolean   @default(false)  // This person/entity pays for studentId's sessions

  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([studentId, relatedStudentId])  // Prevent duplicate links
  @@index([studentId])
  @@index([relatedStudentId])
}
```

### New model: BillingEntity

For corporate sponsors, companies, or any non-individual billing contact.

```prisma
model BillingEntity {
  id                String    @id @default(cuid())

  name              String    // "ABC Corp Employee Wellness"
  contactPerson     String?   // "Jane Smith, HR Manager"
  email             String    // Invoice delivery email
  phone             String?
  vatNumber         String?   // Corporates are often VAT registered
  address           String?
  accountReference  String?   // PO number or internal reference (shown on invoice)

  relationships     ClientRelationship[]
  invoices          Invoice[]

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### New model: Invoice (Universal)

Replaces any existing ad-hoc invoice patterns. One model for all income.

```prisma
model Invoice {
  id                String    @id @default(cuid())

  // Invoice identity
  invoiceNumber     String    @unique  // YYYYMMDD-LT-GS-00001
  type              String    // "monthly_postpaid" | "package_purchase" | "course_purchase" | "product_sale" | "ad_hoc_session" | "other"

  // Who is billed
  studentId         String?             // The client (if individual billing)
  student           Student?  @relation(fields: [studentId], references: [id])
  billingEntityId   String?             // Corporate entity (if corporate billing)
  billingEntity     BillingEntity? @relation(fields: [billingEntityId], references: [id])

  // Billing contact details (snapshot at invoice time — doesn't change if client updates later)
  billingName       String              // "Genna Scott" or "ABC Corp Employee Wellness"
  billingEmail      String
  billingAddress    String?
  billingVatNumber  String?             // "NA" or actual VAT number

  // For monthly postpaid: billing period
  periodStart       DateTime?
  periodEnd         DateTime?
  billingMonth      String?             // "2026-03" — for postpaid invoicing

  // Financials
  currency          String    @default("ZAR")
  subtotalCents     Int                 // Sum of line items before discount
  discountCents     Int       @default(0)
  discountPercent   Float     @default(0)  // Invoice-level discount %
  vatPercent        Float     @default(0)  // 0 if not VAT registered
  vatAmountCents    Int       @default(0)
  totalCents        Int                 // Final amount charged

  // Line items as JSON array
  // [{description, subLine, quantity, unitPriceCents, discountCents, discountPercent, totalCents, bookingId?, productId?, courseId?, orderId?, attendeeName?, status?}]
  lineItems         Json

  // Payment
  status            String    @default("draft")  // "draft" | "payment_requested" | "paid" | "overdue" | "cancelled" | "credited"
  paymentMethod     String?   // "paystack" | "eft" | "cash" | "card" | null
  paystackReference String?
  paymentUrl        String?
  paidAt            DateTime?
  paidAmountCents   Int?
  eftReference      String?   // For manual EFT reconciliation

  // Linked source (what triggered this invoice)
  orderId           String?   // Link to Order model if from a purchase
  paymentRequestId  String?   // Link to PaymentRequest if postpaid

  // PDF
  pdfUrl            String?   // Supabase Storage path

  // Dates
  issuedAt          DateTime?
  dueDate           DateTime?

  // Reminder tracking (for postpaid payment requests)
  reminderSentAt    DateTime?
  overdueSentAt     DateTime?
  waReminderSentAt  DateTime?
  waOverdueSentAt   DateTime?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Credit note reference (if this invoice was credited)
  creditNoteId      String?   // Points to the credit note Invoice

  @@index([studentId])
  @@index([billingEntityId])
  @@index([status])
  @@index([type])
  @@index([billingMonth])
  @@index([invoiceNumber])
}
```

### New model: PaymentRequest (for postpaid billing)

Separates the "please pay" step from the actual invoice. The invoice is only created on payment.

```prisma
model PaymentRequest {
  id                String    @id @default(cuid())

  // Who
  studentId         String?
  student           Student?  @relation(fields: [studentId], references: [id])
  billingEntityId   String?
  billingEntity     BillingEntity? @relation(fields: [billingEntityId], references: [id])

  // What
  billingMonth      String    // "2026-03"
  periodStart       DateTime
  periodEnd         DateTime

  // Financials (preview — actual invoice may differ if VAT settings change)
  currency          String    @default("ZAR")
  subtotalCents     Int
  discountCents     Int       @default(0)
  vatAmountCents    Int       @default(0)
  totalCents        Int
  lineItems         Json      // Same format as Invoice lineItems

  // Payment
  paystackReference String?
  paymentUrl        String?
  status            String    @default("pending")  // "pending" | "paid" | "overdue" | "cancelled"

  dueDate           DateTime

  // Tracking
  sentAt            DateTime?
  reminderSentAt    DateTime?
  overdueSentAt     DateTime?
  waReminderSentAt  DateTime?
  waOverdueSentAt   DateTime?

  // Result
  invoiceId         String?   // Created when payment is confirmed

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([studentId, billingMonth])
  @@unique([billingEntityId, billingMonth])
  @@index([status])
  @@index([dueDate])
}
```

### New model: InvoiceSequence

Atomic counter for invoice numbering.

```prisma
model InvoiceSequence {
  id          String  @id @default("global")
  nextNumber  Int     @default(1)
}
```

Increment via transaction:
```typescript
const seq = await prisma.$transaction(async (tx) => {
  const current = await tx.invoiceSequence.upsert({
    where: { id: "global" },
    create: { id: "global", nextNumber: 2 },
    update: { nextNumber: { increment: 1 } },
  });
  return current.nextNumber - 1; // return the number we're using
});
// seq = 1, 2, 3, ... never resets
```

### Booking model — add invoice/request links

```prisma
  invoiceId          String?
  invoice            Invoice?  @relation(fields: [invoiceId], references: [id])
  paymentRequestId   String?
  paymentRequest     PaymentRequest? @relation(fields: [paymentRequestId], references: [id])

  // Session status annotation for invoicing
  billingNote        String?   // "(no-show)" | "(rescheduled)" | "(cancelled)" | null
```

### Site Settings — Finance config seed

```sql
-- Business details
INSERT INTO "site_settings" ("key", "value", "type", "label", "group") VALUES
('business_name', 'Life Therapy PTY LTD', 'text', 'Business name', 'finance'),
('business_address', '13 Station Street, Unit 2, Blue House, Paarl, 7646', 'textarea', 'Business address', 'finance'),
('business_reg_number', '2019/570691/07', 'text', 'Company registration number', 'finance'),
('invoice_prefix', 'LT', 'text', 'Invoice number prefix', 'finance'),

-- VAT
('vat_registered', 'false', 'boolean', 'VAT registered', 'finance'),
('vat_number', '', 'text', 'VAT number', 'finance'),
('vat_percent', '15', 'number', 'VAT rate (%)', 'finance'),

-- Banking details (shown on invoices for EFT payments)
('bank_name', 'Standard Bank', 'text', 'Bank name', 'finance'),
('bank_account_holder', 'Life Therapy', 'text', 'Account holder name', 'finance'),
('bank_account_number', '10 19 117 888 0', 'text', 'Account number', 'finance'),
('bank_branch_code', '050 210 Paarl', 'text', 'Branch code', 'finance'),

-- Session rates (ex-VAT, in cents)
('rate_individual_cents', '89500', 'number', 'Individual session rate ex-VAT (cents)', 'finance'),
('rate_couples_cents', '110000', 'number', 'Couples session rate ex-VAT (cents)', 'finance'),
('rate_consultation_cents', '0', 'number', 'Free consultation rate (cents)', 'finance'),

-- Billing schedule
('postpaid_billing_day', '20', 'number', 'Monthly billing date (day of month)', 'finance'),
('postpaid_due_day', '28', 'number', 'Payment due date (day of month)', 'finance')
ON CONFLICT ("key") DO NOTHING;
```

---

## Line Item Format

Each line item in the `lineItems` JSON array:

```typescript
interface InvoiceLineItem {
  description: string;      // "Individual Session: 60min - Genna Scott"
                            // "Couples Session: 90min - Genna & Mark Scott"
                            // "Package: 5 Sessions"
                            // "Course: What to do on holidays"
  subLine?: string;         // "Session date: 5.02.2026 at 11.30am"
                            // "Session date: 10.02.2026 at 1pm (rescheduled)"
                            // "Session date: 12.02.2026 at 3pm (no-show)"
  quantity: number;         // Usually 1.00
  unitPriceCents: number;   // Base rate ex-VAT
  discountCents: number;    // Per-line discount (fixed amount)
  discountPercent: number;  // Per-line discount (percentage, applied to unitPrice × quantity)
  totalCents: number;       // (unitPrice × quantity) - discount

  // References (for linking back to source records)
  bookingId?: string;
  productId?: string;
  courseId?: string;
  orderId?: string;

  // Attendee info (for consolidated invoices)
  attendeeName?: string;    // Who attended (may differ from billing contact)
  billingNote?: string;     // "(no-show)" | "(rescheduled)" | "(cancelled)" | null
}
```

**Session line item examples:**
```
Individual Session: 60min - Genna Scott              1.00    R895.00    R895.00
  Session date: 5.02.2026 at 11.30am

Individual Session: 60min - Genna Scott              1.00    R895.00    R895.00
  Session date: 10.02.2026 at 1pm (rescheduled)

Individual Session: 60min - Tyler Scott              1.00    R895.00    R895.00
  Session date: 12.02.2026 at 3pm (no-show)

Couples Session: 90min - Genna & Mark Scott          1.00    R1,100.00  R1,100.00
  Session date: 14.02.2026 at 10am

Individual Session: 60min - Tyler Scott              1.00    R895.00    R895.00
  Session date: 16.02.2026 at 3pm (cancelled)

Initial Consultation: 60min - Genna Scott            1.00    R0.00      R0.00
  Session date: 1.02.2026 at 9am
```

**Product/course line item examples:**
```
Package: 10 Individual Sessions                      1.00    R8,500.00  R8,500.00

Course: What to do on holidays                       1.00    R450.00    R450.00

Bundle: Couples Starter (5 sessions + 2 courses)     1.00    R6,500.00  R6,500.00
```

---

## PDF Invoice Template

Matches Roxanne's current invoice layout exactly.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Tax Invoice                    [LIFE THERAPY LOGO]          │
│  (or just "Invoice" if not VAT registered)                   │
│                                                              │
│  Life Therapy PTY LTD           Number:  20260220-LT-GS-00003│
│                                 Date:    20/02/2026          │
│  VAT No: [only if registered]   Page:    1/1                 │
│  13 Station Street              Reference: GS - LT           │
│  Unit 2, Blue House             Due Date: 28/02/2026         │
│  Paarl                          Overall Discount %: 0.00%    │
│  7646                                                        │
│                                                              │
│  Genna Scott                                                 │
│  Customer VAT No: [only if registered, else omit entirely]   │
│  49 Denoon Drive                                             │
│  Atholl, Sandton                                             │
│  2196                                                        │
│                                                              │
│ ──────────────────────────────────────────────────────────── │
│  Description              Quantity    Excl. Price      Total  │
│ ──────────────────────────────────────────────────────────── │
│  Individual Session: 60min   1.00      R895.00      R895.00  │
│  - Genna Scott                                               │
│    Session date: 5.02.2026 at 11.30am                        │
│                                                              │
│  Individual Session: 60min   1.00      R895.00      R895.00  │
│  - Genna Scott                                               │
│    Session date: 10.02.2026 at 1pm (rescheduled)             │
│                                                              │
│  Individual Session: 60min   1.00      R895.00      R895.00  │
│  - Tyler Scott                                               │
│    Session date: 12.02.2026 at 3pm (no-show)                 │
│                                                              │
│  Couples Session: 90min      1.00      R1,100.00  R1,100.00  │
│  - Genna & Mark Scott                                        │
│    Session date: 14.02.2026 at 10am                          │
│                                                              │
│                                                              │
│ ──────────────────────────────────────────────────────────── │
│  Payment to bank: Standard Bank     Total Discount:    R0.00 │
│  Accountholder: Life Therapy        Total Exclusive: R3,685.00│
│  Account number: 10 19 117 888 0    [Total VAT: R0.00]       │
│  Branch code: 050 210 Paarl         [only if VAT registered] │
│  Co Reg no.: 2019/570691/07                                  │
│                                      Total:       R3,685.00  │
└──────────────────────────────────────────────────────────────┘
```

**Title**: "Tax Invoice" if VAT registered, "Invoice" if not.
**VAT No fields**: Completely omitted (not "NA") when not VAT registered — both business and client.
**Reference field**: Billing contact initials + " - " + invoice prefix.
**Banking details**: Always shown (for EFT option).
**Logo**: Life Therapy logo from public assets, top right.

---

## Discount Model

Three levels of discount, applied in order:

### 1. Per-client standing discount
Stored on Student model:
```prisma
  standingDiscountPercent  Float?    // e.g. 10.0 for 10% off everything
  standingDiscountFixed    Int?      // e.g. 10000 for R100 off per session (cents)
```
Applied automatically to every line item for this client. If both set, percentage is applied first, then fixed amount subtracted.

### 2. Per-invoice discount
Stored on the Invoice:
- `discountPercent` — applied to subtotal after line-item discounts
- `discountCents` — fixed amount off the invoice total

Admin sets this when generating or editing an invoice.

### 3. Per-line-item discount
Stored in the lineItem JSON:
- `discountPercent` — percentage off this line item
- `discountCents` — fixed amount off this line item

Admin can override per line when generating or editing an invoice. Useful for "this session didn't go well — 50% off" scenarios.

**Calculation order:**
```
lineTotal = (unitPrice × quantity)
lineDiscount = max of (lineTotal × lineDiscountPercent / 100, lineDiscountCents)
lineNet = lineTotal - lineDiscount

subtotal = sum of all lineNet values
invoiceDiscount = max of (subtotal × invoiceDiscountPercent / 100, invoiceDiscountCents)
totalExclusive = subtotal - invoiceDiscount

vatAmount = vatRegistered ? totalExclusive × vatPercent / 100 : 0
total = totalExclusive + vatAmount
```

---

## Client Relationships & Billing Links

### Relationship Types
- `partner` — couples therapy pair
- `parent` — parent of a minor client
- `child` — minor client (inverse of parent)
- `sibling` — brother/sister
- `guardian` — legal guardian (not parent)
- `corporate` — linked to a BillingEntity
- `other` — free text label

### Billing Resolution

When generating an invoice for a client, the system determines who to bill:

```typescript
function resolveBillingContact(studentId: string): BillingContact {
  // 1. Check for corporate billing link
  const corpLink = findRelationship(studentId, { isBillingLink: true, billingEntityId: not null });
  if (corpLink) return { type: "corporate", entity: corpLink.billingEntity };

  // 2. Check for individual billing link (parent, guardian, partner paying)
  const indLink = findRelationship(studentId, { isBillingLink: true, relatedStudentId: not null });
  if (indLink) return { type: "individual", student: indLink.relatedStudent };

  // 3. Default: client pays for themselves
  return { type: "self", student: getStudent(studentId) };
}
```

### Consolidated Postpaid Invoicing

For billing contacts who pay for multiple people:

```typescript
// On billing date, group all postpaid clients by their billing contact
const billingGroups = groupBy(postpaidClients, (client) => resolveBillingContact(client.id));

// For each billing contact, create ONE payment request with all linked clients' sessions
for (const [billingContact, clients] of billingGroups) {
  const allSessions = [];
  for (const client of clients) {
    const sessions = getCompletedSessions(client.id, periodStart, periodEnd);
    allSessions.push(...sessions.map(s => ({ ...s, attendeeName: client.name })));
  }
  // Create single payment request for billingContact with allSessions as line items
}
```

### Couples Booking Flow

**Admin creates couples booking:**
1. Select session type → "Couples"
2. Select primary client (who has the couples link)
3. System looks up linked partners → shows dropdown of linked clients with relationship type "partner"
4. Select second person
5. Booking created with both names, session type = couples
6. Billing goes to whichever partner has `isBillingLink = true`, or defaults to primary client

**Portal couples booking:**
1. Client selects "Couples Session"
2. System shows their linked partners
3. Client selects partner
4. Booking created for both

### Couples Credit Deduction (Prepaid)

When a couples session is booked for a prepaid couple:
1. Check billing contact's couples credit balance
2. If available, deduct from billing contact
3. If not available, check partner's balance
4. If neither has credits, block booking (or allow if admin override)

### "Book on Behalf" Flow

A linked client (parent) can book sessions for their linked dependents:
1. Parent logs into portal
2. Sees option: "Book for: [Myself] [Tyler Scott (child)] [Other]"
3. Selects child → books an individual session for the child
4. Session appears on child's schedule
5. Invoice goes to parent (billing link)

---

## Admin Settings — Finance Tab

**NEW:** `app/(admin)/admin/(dashboard)/settings/finance/page.tsx`

Dedicated settings tab with 5 sections:

### Section 1: Business Details
- Business name (text)
- Business address (textarea)
- Company registration number (text)
- Invoice number prefix (text, default "LT")

### Section 2: VAT
- VAT registered (toggle)
- VAT number (text — visible/required only when toggle is on)
- VAT rate % (number, default 15)
- Live preview: "Individual session: R895.00 + R134.25 VAT = R1,029.25" (only when toggle on)

### Section 3: Session Rates (ex-VAT)
- Individual session rate (currency input, R)
- Couples session rate (currency input, R)
- Consultation rate (currency input, R, default R0)
- Live preview showing final client price with/without VAT

### Section 4: Monthly Billing
- Billing date (day picker, 1-28)
- Payment due date (day picker, 1-28)
- Validation: due date must be after billing date
- Smart preview: "Next billing: Friday 20 March → Due: Friday 28 March"
  - Shows shift if weekend/holiday: "20 March is a Saturday → shifted to Friday 19 March"

### Section 5: Banking Details (shown on invoices)
- Bank name (text)
- Account holder (text)
- Account number (text)
- Branch code (text)

---

## Admin Client Profile — Relationships Section

On the client detail page, add a "Relationships & Billing" section:

### Relationships List
Shows all linked clients/entities:
```
Mark Scott — Partner — Billing: Genna pays ✓
Tyler Scott — Child — Billing: Genna pays ✓
ABC Corp — Corporate sponsor — Billing: ABC Corp pays ✓
```

### Add Relationship Dialog
- Search/select another client (or create new BillingEntity)
- Relationship type dropdown
- Relationship label (free text, optional)
- "This person/entity pays for [client]'s sessions" toggle (isBillingLink)
- If partner: "Available for couples booking" (implicit from relationship type)

### Billing Configuration
- Billing type: Prepaid / Postpaid toggle
- Billing email (defaults to client email)
- Standing discount: % and/or fixed amount
- "Bill to Date" button — generates payment request for all unbilled completed sessions up to today, then switches billing type

---

## Admin Client Profile — Billing/Invoices Tab

- **For postpaid clients**: Shows unbilled sessions this month, pending payment requests, invoice history
- **For all clients**: Full invoice history across all types (sessions, courses, products, packages)
- Quick actions: Generate Invoice, Resend, Mark as Paid (EFT/cash), Void, Download PDF

---

## Paystack Integration

### Every successful payment → Invoice

**EDIT:** `app/api/webhooks/paystack/route.ts`

In the `charge.success` handler, after processing the payment type (course, package, product, etc.):

```typescript
// After existing payment processing logic:
const invoice = await createInvoiceFromPayment({
  type: determineInvoiceType(metadata), // "package_purchase", "course_purchase", etc.
  studentId: metadata.studentId,
  orderId: metadata.orderId,
  amount: event.data.amount,
  currency: event.data.currency,
  paystackReference: event.data.reference,
  metadata: event.data.metadata,
});

// Generate PDF
await generateAndStoreInvoicePDF(invoice.id);

// Send invoice email (with PDF attached)
await sendInvoiceEmail(invoice.id);
```

### Postpaid Payment Request → Invoice

When Paystack confirms payment of a postpaid payment request:

```typescript
if (metadata.type === "payment_request") {
  const request = await prisma.paymentRequest.findUnique({ where: { id: metadata.paymentRequestId } });

  // Create official invoice from the payment request data
  const invoice = await createInvoiceFromPaymentRequest(request, {
    paystackReference: event.data.reference,
    paidAmountCents: event.data.amount,
  });

  // Update payment request status
  await prisma.paymentRequest.update({
    where: { id: request.id },
    data: { status: "paid", invoiceId: invoice.id },
  });

  // Generate PDF & send
  await generateAndStoreInvoicePDF(invoice.id);
  await sendInvoiceEmail(invoice.id);
}
```

---

## Monthly Postpaid Cron

**NEW:** `app/api/cron/monthly-billing/route.ts`

Runs daily. Checks today's date against billing/reminder/overdue dates.

### Billing Date (e.g. 20th)
1. Get all postpaid clients (and their billing contacts via relationship resolution)
2. Group by billing contact (for consolidated invoices)
3. For each billing contact:
   - Gather all completed sessions from linked postpaid clients for the billing period
   - Include billing notes: (no-show), (rescheduled), (cancelled)
   - Apply standing discounts if any
   - Calculate subtotal, VAT, total
   - Create `PaymentRequest` record
   - Generate Paystack payment link
   - Send email with session summary + Paystack link
   - Send WhatsApp if opted in
4. Sessions after billing date roll to next month

### Smart Date Shifting
- Billing date and due date shift to preceding business day if weekend or SA public holiday
- Reuses `lib/sa-holidays.ts` (already built for WhatsApp reminders)

### Reminder: 2 Business Days Before Due Date
- Query unpaid PaymentRequests for current month
- Send friendly reminder via email + WhatsApp
- "Hi {{name}}, a friendly reminder that your Life Therapy invoice of R{{amount}} is due before {{dueDate}}. Pay here: {{link}}"

### Overdue: 1 Business Day After Due Date
- Query still-unpaid PaymentRequests
- Mark as overdue
- Send overdue notice via email + WhatsApp
- "Hi {{name}}, please note we have not yet received payment of R{{amount}} for your {{month}} sessions. The invoice was due on {{dueDate}}. Pay here: {{link}}"

---

## Booking Flow Changes

### Postpaid Clients — No Credit Check
When booking for a postpaid client:
- Skip credit balance check
- Skip credit deduction on completion
- Session will appear on next billing cycle's payment request

### Billing Note on Session Status Change
When a booking status changes to cancelled/rescheduled/no-show:
- Set `billingNote` on the booking record
- This note appears on the invoice line item

### Postpaid Ad-Hoc Purchases
If a postpaid client buys a course, product, or package:
- Payment is immediate via Paystack (not deferred to month-end)
- Invoice generated on payment confirmation
- Only sessions are postpaid; everything else is pay-now

---

## Bill-to-Date Admin Action

For switching a client's billing type:

```typescript
async function billToDateAction(studentId: string, newBillingType: "prepaid" | "postpaid") {
  // 1. Get all completed, unbilled sessions for this client
  const unbilledSessions = await getUnbilledSessions(studentId);

  if (unbilledSessions.length > 0 && currentBillingType === "postpaid") {
    // 2. Generate a payment request for everything up to today
    const request = await createPaymentRequest(studentId, unbilledSessions);
    // 3. Send to client
    await sendPaymentRequestEmail(request.id);
  }

  // 4. Switch billing type
  await prisma.student.update({
    where: { id: studentId },
    data: { billingType: newBillingType },
  });

  // 5. Future sessions follow new billing type rules
}
```

---

## Email Templates

### `invoice` (sent with every invoice — all types)
Subject: "Life Therapy Invoice {{invoiceNumber}} — {{currency}} {{totalFormatted}}"
Body: Greeting, summary of what was purchased/billed, "Your invoice is attached." PDF attached.

### `payment_request` (sent to postpaid clients on billing date)
Subject: "Your Life Therapy sessions for {{month}} — {{currency}} {{totalFormatted}}"
Body: Session summary table, total, due date, prominent "Pay Now" button.

### `payment_request_reminder` (2 business days before due)
Subject: "Friendly reminder — payment due {{dueDate}}"
Body: "Hi {{name}}, a friendly reminder that your Life Therapy payment of {{amount}} is due before {{dueDate}}. [Pay Now]"

### `payment_request_overdue` (1 business day after due)
Subject: "Payment overdue — Life Therapy {{month}}"
Body: "Hi {{name}}, please note we have not yet received payment of {{amount}} for your {{month}} sessions. The invoice was due on {{dueDate}}. [Pay Now]"

---

## WhatsApp Templates (Manual — Create in Meta Business)

### `monthly_payment_request`
- Category: Utility
- Body: `Hi {{1}}, your Life Therapy sessions for {{2}} are ready for payment. Total: {{3}}, due before {{4}}. Pay here: {{5}}`

### `payment_request_reminder`
- Category: Utility
- Body: `Hi {{1}}, friendly reminder that your Life Therapy payment of {{2}} is due before {{3}}. Pay here: {{4}}`

### `payment_request_overdue`
- Category: Utility
- Body: `Hi {{1}}, please note we have not yet received payment of {{2}} for your {{3}} sessions. The invoice was due on {{4}}. Pay here: {{5}}`

### `invoice_sent`
- Category: Utility
- Body: `Hi {{1}}, your Life Therapy invoice {{2}} for {{3}} has been sent to your email. Thank you for your payment!`

---

## Portal — Client Invoice & Payment View

### For all clients:
- Invoice history list: date, number, type, amount, status badge, "Download PDF" button
- Filter by: year, type, status

### For postpaid clients (additional):
- Current month's sessions (what's been completed so far)
- Pending payment request with "Pay Now" button
- Note: "Sessions after [billing date] will appear on next month's statement"

---

## Accountant Export

**Admin action:** "Export Invoices" with filters:
- Financial year: dropdown (e.g. "FY2026: 1 Mar 2025 – 28 Feb 2026")
- Date range: custom from/to
- Type: all / monthly_postpaid / package / course / product
- Status: all / paid / overdue / cancelled

**Output:** CSV or Excel with columns:
- Invoice Number, Date, Client Name, Billing Contact, Type, Description, Currency, Subtotal, Discount, VAT, Total, Payment Method, Payment Date, Paystack Reference, EFT Reference

One row per invoice, not per line item. Line item detail is on the PDF.

---

## Currency

**All transactions are ZAR.** Paystack SA only supports ZAR as a charge currency.

- `life-therapy.co.za` and `life-therapy.online` both charge in ZAR via Paystack
- International clients on `life-therapy.online` see USD/EUR/GBP as *display prices* for reference only (stored on Course/Package/DigitalProduct models)
- At Paystack checkout, the amount is always ZAR — the client's bank handles FX conversion on their end
- All invoices are ZAR with R symbol
- The `currency` field on Invoice defaults to "ZAR" and is not expected to change, but remains on the model for future-proofing

---

## Credit Note Model (Future — Build Model Now, UI Later)

When a refund is issued:

```prisma
// Credit notes are just Invoice records with negative amounts and type "credit_note"
// invoiceNumber format: CN-YYYYMMDD-LT-GS-00248
// creditNoteId on the original invoice points to the credit note
// The credit note's lineItems reference the original invoice's line items
```

Credit notes use the same sequence counter (they're just invoices with negative amounts). The "CN-" prefix distinguishes them visually.

---

## Files Summary

| # | File | Action |
|---|------|--------|
| 1 | `prisma/schema.prisma` | EDIT — add billingType/billingEmail/billingAddress/standingDiscount to Student, add ClientRelationship, BillingEntity, Invoice, PaymentRequest, InvoiceSequence models, add billingNote/invoiceId/paymentRequestId to Booking |
| 2 | Migration SQL | NEW — all new tables + columns |
| 3 | `lib/billing.ts` | NEW — billing date utilities, VAT calc, rate lookup, discount calc |
| 4 | `lib/billing-contacts.ts` | NEW — resolve billing contact from relationships |
| 5 | `lib/generate-payment-requests.ts` | NEW — monthly postpaid payment request generation |
| 6 | `lib/create-invoice.ts` | NEW — universal invoice creation (from payment, from payment request) |
| 7 | `lib/invoice-numbering.ts` | NEW — atomic sequence counter, number formatting |
| 8 | `lib/billing-paystack.ts` | NEW — Paystack payment link for payment requests |
| 9 | `lib/generate-invoice-pdf.ts` | NEW — PDF generation matching template |
| 10 | `lib/send-invoice.ts` | NEW — send invoice email with PDF + optional WhatsApp |
| 11 | `lib/send-payment-request.ts` | NEW — send payment request email/WhatsApp |
| 12 | `app/api/cron/monthly-billing/route.ts` | NEW — daily cron for billing/reminders/overdue |
| 13 | `app/api/webhooks/paystack/route.ts` | EDIT — create invoice on every charge.success |
| 14 | `vercel.json` | EDIT — add cron (or combine into existing) |
| 15 | `lib/email-template-defaults.ts` | EDIT — add 4 email templates |
| 16 | `lib/email-render.ts` | EDIT — add 4 template renderers |
| 17 | Booking actions | EDIT — skip credit check/deduction for postpaid, add billingNote |
| 18 | Booking validation | EDIT — skip credit check for postpaid |
| 19 | Admin settings — Finance tab | NEW — 5-section finance configuration page |
| 20 | Admin client profile — Relationships | NEW — link clients, set billing contacts |
| 21 | Admin client profile — Billing tab | NEW — invoice history, payment requests, actions |
| 22 | Admin billing entities | NEW — CRUD for corporate billing entities |
| 23 | Admin invoice list | NEW — all invoices, filters, bulk actions, export |
| 24 | Portal invoices page | NEW — client invoice history, pay, download |
| 25 | Portal booking — couples/behalf | EDIT — couples selection, book-on-behalf |
| 26 | Site settings seed SQL | EDIT — add finance config values |
| 27 | Supabase Storage | NEW — `invoices/` bucket for PDF storage |

---

## WhatsApp Templates to Create (Manual — Meta Business)

4 new templates:
1. `monthly_payment_request` — Utility
2. `payment_request_reminder` — Utility
3. `payment_request_overdue` — Utility
4. `invoice_sent` — Utility

---

## Verification

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Client buys a course via Paystack | Invoice auto-created on payment, PDF generated, emailed |
| 2 | Client buys a 10-session package | Invoice created, credits added, PDF sent |
| 3 | Postpaid client has 4 sessions, billing date arrives | Payment request sent with 4 line items + Paystack link |
| 4 | Postpaid client pays via Paystack link | Invoice created with next sequential number, PDF generated |
| 5 | Parent is billing contact for child + couples | One consolidated payment request with all sessions |
| 6 | Corporate entity sponsors 3 employees | One payment request to corporate email with all 3 clients' sessions |
| 7 | Session marked as no-show | "(no-show)" appears on invoice line item |
| 8 | Billing date falls on Saturday | Shifted to preceding Friday |
| 9 | 2 business days before due date | Friendly reminder sent (email + WhatsApp) |
| 10 | 1 business day after due date, unpaid | Overdue notice sent, status updated |
| 11 | Admin marks invoice as paid (EFT) | Status → paid, EFT reference stored |
| 12 | Admin clicks "Bill to Date" then switches prepaid→postpaid | Payment request for all unbilled sessions, then billing type switches |
| 13 | Postpaid client buys a course | Immediate Paystack payment + invoice (not deferred) |
| 14 | Invoice numbers sequential | No gaps: 00001, 00002, 00003... across all types |
| 15 | VAT toggle off | No VAT fields on any invoice |
| 16 | VAT toggle on | VAT calculated, VAT number shown, "Tax Invoice" title |
| 17 | Client with 10% standing discount | All line items auto-discounted |
| 18 | Admin adds per-line discount | Specific line item discounted, others normal |
| 19 | Zero sessions in billing period | No payment request generated (skipped) |
| 20 | Free consultation + paid sessions (converted client) | R0 consultation line + paid session lines on same invoice |
| 21 | Display prices on .online in USD/GBP/EUR | Checkout still charges ZAR, invoice is ZAR |
| 22 | Accountant export for FY2026 | CSV with all invoices from 1 Mar 2025 – 28 Feb 2026 |
| 23 | Duplicate Paystack webhook | Invoice not created twice (idempotency check on paystackReference) |
| 24 | Paystack link expired | Admin can regenerate payment link without new invoice |
| 25 | Admin voids invoice | Status → cancelled, linked bookings freed for re-invoicing |
| 26 | Two payments same day, different clients | Sequential numbers: ...00045, ...00046 (atomic counter) |
| 27 | Portal: client views invoices | Sees all their invoices across types, can pay + download PDF |
| 28 | Couples booking from portal | Partner selection from linked clients, both names on booking |