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
- **Never modify the Prisma schema without being explicitly told to.** If you think a schema change is needed, describe it and wait for confirmation. When one IS approved, it goes through the Supabase Management API — **`prisma migrate` and `prisma db push` do not work on this project** and are blocked. See `.claude/rules/schema-changes.md`.
- **Never delete data.** Use soft-delete patterns (status flags, `isActive: false`, `archivedAt` timestamps).
- **Never hand-roll a date.** No `new Date(y, m, d)`, no `.toISOString().slice(0, 10)` on a timestamp, no `format()` for display, no hardcoded `+02:00`. Everything goes through `lib/dates.ts` — see below.
- **Never push.** Commit, report, and wait. The user walks and visually checks the work before it goes out.
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
- **Use `recordAudit()` from `lib/audit.ts`** for billing type changes, booking cancellations, payment recording, invoice voiding, client status changes, and discount changes.

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

### Dates & Timezone — `lib/dates.ts` is the only source of truth

The business runs in **SAST (Africa/Johannesburg, UTC+2, no DST)**. Vercel runs in **UTC**. Every
date bug this codebase has had came from confusing two things:

- A **calendar date** is a *day*. `booking.date`, `originalDate`, `dateOfBirth` are Prisma `@db.Date`
  columns stored at UTC midnight. Build them with `calendarDate("2026-07-08")`.
- A **real instant** is a *moment*. `createdAt`, `paidAt`, `new Date()`. Resolve them to a day with
  `saDateStr(x)` — **never** `.toISOString().slice(0, 10)`, which gives the *UTC* day and is wrong
  for two hours every night. **The SAST day turns over at 22:00 UTC**, not midnight.

`lib/dates.ts` owns `TIMEZONE` and exports: `saDateStr`, `saToday`, `saFormat`, `saInstant`,
`saDayStart`, `saDayEnd`, `calendarDate`, `addSaDays`, `diffSaDays`, `saMonthStart`, `isSameSaDay`,
`bookingStartsAt`, `isSaDateStr`.

Rules:
- **It fails closed.** Malformed input throws rather than returning an `Invalid Date` (which compares
  `false` both ways, so a Prisma `where` built from one silently matches nothing — a failure that
  reads exactly like "no results"). At untrusted boundaries (query params, imports) guard with
  `isSaDateStr()` first and fall back.
- **Ranges over a timestamp column** use `gte: saDayStart(d), lt: saDayStart(addSaDays(d, 1))` — an
  exclusive next-day start. `saDayEnd` is inclusive-to-the-second and misses the last 999ms.
- **Thresholds phrased in days** use `diffSaDays`, not a division by 86,400,000 (23:00 Mon → 08:00
  Tue is 1 calendar day but floors to 0).
- **Exceptions that look like bugs but aren't:** `.slice(0, 10)` on a `@db.Date` is exact; and two
  Graph call sites slice a datetime string legitimately because the request sends a
  `Prefer: outlook.timezone` header, so Graph returns SAST-local strings. Do not "fix" those.
- `npm run test:dates` pins the boundaries. Run it whenever you touch date handling.

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
MS_GRAPH_TENANT_ID                — Microsoft 365 tenant
MS_GRAPH_CLIENT_ID                — Azure AD app registration
MS_GRAPH_CLIENT_SECRET            — Azure AD secret
MS_GRAPH_USER_EMAIL               — Roxanne's Microsoft 365 email (calendar owner)
RESEND_API_KEY                    — Email delivery via Resend
SUPABASE_ACCESS_TOKEN             — Supabase Management API (schema changes; see .claude/rules/)
```

> The Graph vars are `MS_GRAPH_*`, **not** `GRAPH_*`. This was mis-documented and cost a debugging
> session. The real values live in `.env.local`; `.env` holds a `johndoe@localhost` placeholder
> `DATABASE_URL`, so one-off scripts need `npx tsx --env-file=.env.local`.

---

## Pre-Commit Check

Run before every commit:
```bash
npm run check
```

This runs TypeScript type checking (`tsc --noEmit`) + ESLint. If it
fails, fix the errors before committing. Do not push code that fails
`npm run check`.

`npm run check` is now a gauntlet, not just a typecheck:

```
tsc --noEmit
  && eslint . --max-warnings 0        ← warnings are errors; they never accumulate
  && node scripts/architecture-audit.mjs
  && npm run test:dates
```

Quick commands:
- `npm run typecheck` — TypeScript only
- `npm run lint` — ESLint only (`--max-warnings 0`)
- `npm run audit` — the architecture audit alone
- `npm run test:dates` — boundary tests for `lib/dates.ts`
- `npm run check` — all four (run this before every commit)

### The architecture audit (`scripts/architecture-audit.mjs`)

Typecheck and ESLint catch *syntax* mistakes. They cannot catch "this server action mutates the DB
without `requireRole`", or "this invoice adds SA VAT to a USD client". Those are the bugs that keep
reaching production, so they get a scanner. **Each check is named after the bug class it catches, and
every one exists because we shipped that bug.** When a new class gets through, add a check — the
suite grows a scar for every wound.

Two rules keep it trustworthy:

- **Classify per site, never sweep.** Half of every first run is false positives. A scanner that
  cries wolf is one people learn to wave through — which is worse than no scanner, because it reports
  a reassuring green. Both allowlists (`ZAR_BY_CONSTRUCTION`, `REVALIDATE_EXCEPTIONS`) carry a
  *reason* per entry: they are decision logs, not silencers.
- **Prove the probe fires.** A check that cannot fail is worthless. Plant a violation, confirm the
  check catches it, remove it. The `+02:00` check silently never fired until a planted probe exposed
  that it was scanning comment-stripped source, where string literals — the only place an offset ever
  lives — had already been removed.

**`KNOWN_DEFECTS` is a ratchet.** Real, classified bugs live there so unrelated work isn't blocked,
while any *new* finding fails the build. The list may only ever shrink; the audit fails if an entry
stops firing, so it can't outlive its bug. An entry is a debt, not a dismissal.

---

## Agents, Commands & Permissions (`.claude/`)

The harness is configured to keep judgment in the main session and push the bulk work — sweeps,
codemods, live-DB reads, adversarial review — out to subagents with their own context.

### Agents (`.claude/agents/`)

| Agent | Use it for | Model |
|---|---|---|
| `grounder` | **Before writing any code.** Maps the existing machinery a task touches so you extend it instead of duplicating it. Read-only. | sonnet |
| `census` | Repo-wide counts, find-all-usages, pattern audits. Returns *classified* hits, not file dumps. Read-only. | sonnet |
| `db-inspector` | Verifying a live-data claim against production. Every answer comes back with the query behind it. **SELECT only.** | sonnet |
| `implementer` | A pre-scoped mechanical transform (codemod, rename sweep). Spawn with `isolation: "worktree"`. Never pushes. | sonnet |
| `walker` | Adversarial pre-push review. Tries to *refute* the work. Independent context is the point. Read-only. | opus |

The recurring lesson encoded in all of them: **classify per site, never sweep.** A pattern that looks
uniform usually isn't — during the date centralisation, two call sites identical to 25 others were
correct for a reason invisible to the regex. Blanket codemods break production.

### Commands (`.claude/commands/`)

- **`/walk`** — adversarial review of the current diff against `origin`, before anything is pushed.
- **`/wrap`** — session close: checks green, commit, handoff report. **Explicitly does not push.**

### Permissions (`.claude/settings.json` + `.claude/hooks/bash-gate.js`)

Default mode is `acceptEdits`, with read-only MCP calls (Supabase inspection, Vercel logs, GitHub
PR reads) pre-allowed so routine work doesn't prompt. The gates that matter:

- **Denied outright:** `git push --force`, `git reset --hard`, `rm -rf /`, and **`prisma migrate` /
  `prisma db push`** (they do not work here — see `.claude/rules/schema-changes.md`). Reading `.env*`
  is denied.
- **Always asks:** `git push` (the user walks the work first — this is a standing rule, not a
  formality), any SQL against production, Prisma schema operations, and deploys.

> **The Supabase MCP tools do not work here.** Every call — even a read-only `list_tables` — returns
> `MCP error -32600: You do not have permission`. Query production through the **Management API over
> REST** (`SUPABASE_ACCESS_TOKEN` from `.env.local`); see `.claude/rules/schema-changes.md`. This
> applies to reads as much as to DDL.

The `bash-gate.js` PreToolUse hook exists because allow-rules can't cover commands containing `$()`
or heredocs — Claude Code decomposes those and prompts anyway, which stalls a long session on a
trivial grep. The hook decides *before* the permission system: allow by default, gate the named
dangerous shapes. `deny`/`ask` rules in `settings.json` still override a hook `allow`, so the two are
belt-and-braces.

### Rules (`.claude/rules/`)

- **`schema-changes.md`** — why `prisma migrate` fails on this project (the pgbouncer pooler) and the
  Management API path that actually works.

---

## Brand Quick Reference

- **Brand voice**: Warm, empowering, professional but approachable
- **Phrase**: "You are not broken. You are becoming."
- **Palette**: Sage green `#87A878`, cream `#F5F0E8`, dark sage `#5C7A52`, terracotta `#C4704F`
- **Fonts**: Playfair Display (headings), Lora (body), Cormorant Garant (accent)
- **Admin UI**: shadcn/ui components with default theme (not brand-styled)
