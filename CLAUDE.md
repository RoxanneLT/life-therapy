# CLAUDE.md — Life-Therapy Platform

## Project Overview

Life-Therapy is an online counselling and life coaching platform built with **Next.js 14+ (App Router)**, **Prisma** (PostgreSQL), **Supabase Auth**, **Paystack** payments, and deployed on **Vercel**. The admin manages clients, bookings, billing, courses, digital products, and email communications. Clients access a portal for bookings, session history, course content, and invoices.

**Domains:**
- `life-therapy.co.za` — South African clients (ZAR)
- `life-therapy.online` — International clients (USD/EUR/GBP)

---

## Critical Rules

### DO NOT
- **Never hardcode prices, rates, or currency.** Always read from `SiteSetting`, `BillingPreset`, or the booking's stored price/currency.
- **Never hardcode "ZAR" as the currency.** Always derive from the booking's `priceCurrency`, the student's region, or the PaymentRequest's `currency` field.
- **Never create parallel systems when you can extend existing ones.** Example: manual invoices reuse the pro-forma → Paystack → tax invoice pipeline, they don't build a second invoicing flow.
- **Never modify the Prisma schema without being explicitly told to.** If you think a schema change is needed, describe it and wait for confirmation.
- **Never delete data.** Use soft-delete patterns (status flags, `isActive: false`, `archivedAt` timestamps).
- **Never send emails or trigger external side effects in a "save" action.** Side effects (email, PDF generation, Paystack link creation) only happen when the user explicitly clicks "Send" or "Create & Send".
- **Never auto-fill or guess client data.** If a field needs a value and you don't have it, leave it empty or show a placeholder.
- **Never use `any` types.** Use proper Prisma types or define interfaces.

### ALWAYS
- **Read the actual files before writing code.** Don't assume structure — the codebase has specific patterns. Read the component, its imports, and the actions file before making changes.
- **Use `requireRole("super_admin", "editor")` on every server action** that modifies data. Read-only actions can use `requireRole("super_admin")` alone.
- **Use `revalidatePath()` after every mutation** to refresh the relevant page data.
- **Use `toast` from `sonner` for success/error feedback** on client-side actions.
- **Use confirmation dialogs for destructive actions** (cancel, void, delete, send).
- **Handle errors with try/catch and user-friendly messages.** Never let raw errors reach the UI.
- **Use the existing `formatPrice(cents, currency)` utility** for all currency display.

---

## Architecture & Patterns

### File Structure
```
app/
  (admin)/admin/(dashboard)/   ← Admin pages (requires auth + role check)
  (public)/                    ← Public-facing pages (marketing, booking, login)
  (portal)/portal/             ← Client portal (requires student auth)
  api/                         ← API routes (webhooks, downloads, cron triggers)
  auth/callback/               ← Supabase auth callback handler

components/
  admin/                       ← Admin-specific components
  public/                      ← Public site components
  portal/                      ← Client portal components
  ui/                          ← shadcn/ui primitives

lib/
  billing.ts                   ← Date utils, VAT/discount calc, rate lookup, billing contact resolution
  billing-types.ts             ← InvoiceLineItem type definition
  generate-payment-requests.ts ← Monthly billing run (postpaid clients)
  generate-invoice-pdf.ts      ← jsPDF-based invoice and pro-forma PDF generation
  send-invoice.ts              ← All payment request + invoice email functions
  email-render.ts              ← Template rendering (DB templates with fallback to hardcoded)
  email-templates.ts           ← Hardcoded email template functions + base wrapper
  graph.ts                     ← Microsoft Graph API (calendar events, Teams meetings)
  booking-config.ts            ← SESSION_TYPES, TIMEZONE, slot times
  settings.ts                  ← getSiteSettings() — single source of truth for config
  pricing.ts                   ← Multi-currency price helpers
  region.ts                    ← Region/currency types and config
  credits.ts                   ← Session credit balance, deduct, forfeit
  cron/                        ← Scheduled job processors (billing, reminders, follow-ups)

prisma/
  schema.prisma                ← Single schema file, PostgreSQL
```

### Server Actions Pattern
All admin mutations are server actions in `actions.ts` files co-located with their page:
```typescript
"use server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function doSomethingAction(data: SomeType) {
  await requireRole("super_admin", "editor");
  // ... mutation logic ...
  revalidatePath("/admin/relevant-page");
  return { success: true };
}
```

### Component Pattern
- Pages are server components that fetch data and pass it as props.
- Interactive parts are extracted into `"use client"` components.
- Forms use `useActionState` or `useTransition` with server actions.
- Toast notifications via `sonner` for all user-facing feedback.

### Email System
Emails use a two-layer system:
1. **DB templates** (`EmailTemplate` model) — editable by admin, checked first
2. **Hardcoded fallbacks** (`email-render.ts` → `email-templates.ts`) — used when DB template doesn't exist or is inactive

Template variables are `{{variableName}}` placeholders. The call site pre-computes any HTML blocks (session summaries, Teams links) and passes them as string variables.

### Billing Flow (Postpaid Clients)
```
Monthly cron → generateMonthlyPaymentRequests()
  → creates PaymentRequest records with line items
  → sendPaymentRequestEmail() sends email + pro-forma PDF
  → reminder/due-today/overdue emails on schedule
  → client pays via EFT
  → admin records payment via "Record Payment" action
  → real tax invoice generated + emailed
```

### Multi-Currency
- Bookings store `priceCurrency` (ZAR/USD/EUR/GBP) and `priceZarCents` (price in that currency's cents)
- PaymentRequests have a `currency` field
- All `formatPrice()` calls must pass the correct currency
- VAT applies to ZAR only — international currencies are zero-rated
- Session rates are configured per-currency in SiteSettings

### Calendar Integration (Microsoft Graph)
- Single bookings: one Graph event per booking
- Recurring series: ONE recurring Graph event for the whole series (not N individual events)
- All bookings in a series share the same `graphEventId` (the series master ID)
- Cancelling/rescheduling a single booking in a series: delete/modify that occurrence only, NOT the entire series
- Check `booking.recurringSeriesId` — if present, use `deleteRecurringEventOccurrences()` instead of `cancelCalendarEvent()`

---

## Naming Conventions

- **Server actions**: `verbNounAction` — e.g. `createManualPaymentRequestAction`, `excludeFromBillingAction`
- **Components**: PascalCase — e.g. `UpcomingBillingSection`, `PaymentRequestActions`
- **Files**: kebab-case — e.g. `upcoming-billing-section.tsx`, `payment-request-actions.tsx`
- **DB fields**: camelCase matching Prisma convention
- **CSS**: Tailwind utility classes only, no custom CSS files
- **Currency amounts**: Always stored as integer cents. Display with `formatPrice(cents, currency)`.

---

## Common Pitfalls

1. **`priceZarCents` is misnamed.** It stores cents in WHATEVER currency the booking used, not necessarily ZAR. Always check `priceCurrency` alongside it.

2. **`getSessionRate()` in `lib/billing.ts` is for fallback rate lookup only.** When billing existing bookings, use the booking's stored price, not a re-fetched rate.

3. **PaymentRequest unique constraint is `[studentId, billingMonth]`.** If creating multiple PRs for the same client in the same month (different currencies), append the currency to the billingMonth key.

4. **Supabase auth tokens in URLs must be `encodeURIComponent()`-encoded.** Base64 tokens contain `+` and `/` which break in query strings.

5. **The `(public)` route group layout wraps all public pages** including `/reset-password` and `/login`. It does NOT have auth guards.

6. **Email template changes need TWO updates**: the hardcoded fallback in `email-render.ts` AND the DB-stored template (if it exists and is active). Use the admin email template editor or a migration script.

7. **Recurring calendar events**: after the recent refactor, all bookings in a series share one `graphEventId`. The old pattern of calling `cancelCalendarEvent` per booking would delete the entire series. Always check `recurringSeriesId` first.

---

## Testing Checklist (before deploying)

- [ ] All server actions have `requireRole()` as the first line
- [ ] All mutations call `revalidatePath()` for affected pages
- [ ] Currency formatting uses `formatPrice(cents, currency)` — never manual string concatenation
- [ ] Email sends have `.catch(console.error)` — never let email failures crash the request
- [ ] Prisma queries use `select` or `include` to limit data — never fetch entire records when only IDs are needed
- [ ] New UI components handle empty states (no data, loading, error)
- [ ] Destructive actions have confirmation dialogs

---

## Environment Variables (key ones)

```
NEXT_PUBLIC_SUPABASE_URL          — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY     — Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY         — Supabase admin key (server-only)
PAYSTACK_SECRET_KEY               — Paystack API key
NEXT_PUBLIC_APP_URL               — Primary domain (https://life-therapy.co.za)
NEXT_PUBLIC_BASE_URL              — Same as APP_URL (used in some email templates)
GRAPH_TENANT_ID                   — Microsoft 365 tenant
GRAPH_CLIENT_ID                   — Azure AD app registration
GRAPH_CLIENT_SECRET               — Azure AD secret
GRAPH_USER_EMAIL                  — Roxanne's Microsoft 365 email (calendar owner)
RESEND_API_KEY                    — Email delivery via Resend
```

---

## Brand Quick Reference

- **Brand voice**: Warm, empowering, professional but approachable
- **Phrase**: "You are not broken. You are becoming."
- **Palette**: Sage green `#87A878`, cream `#F5F0E8`, dark sage `#5C7A52`, terracotta `#C4704F`
- **Fonts**: Playfair Display (headings), Lora (body), Cormorant Garant (accent)
- **Admin UI**: shadcn/ui components with default theme (not brand-styled)
