# CLAUDE.md — Life-Therapy Platform

## START HERE — where the repo lives, and the first thing to do in a session

**The repo lives OUTSIDE OneDrive. The exact path is per-machine.**

| Machine | Path |
|---|---|
| Laptop | `C:\dev\life-therapy` (alongside `C:\dev\pleks`) |
| Desktop | **not yet decided** — it has C/D/E/F; the working volume is a Windows Storage Space (RAID-10), and one of the others is OneDrive. Deliberately left blank rather than guessed. |

Don't hardcode `C:\dev` into anything, and don't guess the desktop's drive. The
invariant is *not inside OneDrive*; the drive is a per-machine preference.

Nothing is blocked by the unknown: `SETUP-NEW-PC.ps1` lists the machine's drives
with their free space and asks. **When the desktop is first set up, write the chosen
path into the table above** so the next session doesn't have to ask again.

Stean works from more than one machine, so the instinct is to keep the project in
OneDrive. Don't. On 2026-08-17 that combination cost a working day: `node_modules`
became a field of unreadable cloud placeholders (`npm` itself could not run), and
then **118 git objects went unreadable** — `git fsck`, `git rev-list` and `git push`
all failed with `mmap failed: Invalid argument`, so finished work could not be
shipped at all. Thousands of tiny files, placeholder hydration, and two machines
writing pack files independently are what break it. Syncing the *code* was never the
problem; syncing the *repo internals* was.

**Git syncs the code. OneDrive syncs only what git ignores.**

### First moves in any session, before touching code

```bash
git status          # never assume this machine is current
git fetch && git log --oneline HEAD..origin/master   # what landed elsewhere?
git pull            # another machine may have pushed
npm run secrets     # are .env.local etc. in sync with OneDrive?
```

`git status` first is not a formality here. A second machine may have pushed, and
this is a codebase where a stale local copy silently reintroduces fixed bugs.

### Setting up a machine that has never had the repo

There is a bootstrap problem, and it is already solved: a fresh machine has no
working folder, because the repo no longer arrives by sync. The one thing that DOES
still arrive is the secrets folder — so the installer lives there:

> **`~/OneDrive/dev-secrets/life-therapy/SETUP-NEW-PC.ps1`** — right-click → *Run
> with PowerShell*. It **asks where to put the repo**, listing the machine's drives
> and their free space, then clones, runs `npm ci`, copies the secrets into place
> and runs `npm run check`. Safe to re-run (pulls if the repo already exists).
> `README.txt` beside it explains the layout.
>
> Pass the path directly to skip the prompt — this is the desktop case:
> `.\SETUP-NEW-PC.ps1 -RepoPath 'E:\dev\life-therapy'`
>
> It **refuses any path containing "onedrive"**, which is the mistake it exists to
> prevent.

Equivalent by hand (substitute your own drive):

```bash
git clone https://github.com/RoxanneLT/life-therapy.git <YOUR-PATH>\life-therapy
cd <YOUR-PATH>\life-therapy
npm ci                 # postinstall runs `prisma generate`
npm run secrets:pull   # brings .env.local, .env, .claude/settings.local.json
npm run check          # expect green: tsc + eslint + 26 audit checks + 139 tests
```

### The secrets channel

Git deliberately does not carry `.env.local`, `.env` or
`.claude/settings.local.json`. Those live in `~/OneDrive/dev-secrets/life-therapy`
and move with `scripts/sync-secrets.mjs`:

- `npm run secrets` — status only, changes nothing
- `npm run secrets:pull` — OneDrive → this working copy (after a clone, or when the
  other machine changed a key)
- `npm run secrets:push` — this working copy → OneDrive (after YOU change one)

`LT_SECRETS_DIR` overrides the location if OneDrive sits elsewhere on a machine.

> If you find yourself working in `C:\Users\stean\OneDrive\Websites\Life Therapy`,
> stop. That is the retired copy, and its `.git` is damaged. Move to the real one.

**Picking up mid-stream?** `docs/SESSION_HANDOVER_2026-08-17.md` is the current state:
what was fixed, the three DDL changes already live in production, the open TODO list in
priority order, and the claims that were reasoned rather than demonstrated.

---

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

### URLs & the two domains

`life-therapy.co.za` (ZAR) and `life-therapy.online` (international) are served by **one deployment**;
region is decided per-request from the hostname. So a URL in an email/PDF must follow the recipient's
region, never a hardcoded domain. Three resolvers, in `lib/region.ts`:

- `getBaseUrl()` (`lib/get-region.ts`) — request context; reads the region cookie the middleware set.
- `getBaseUrlForCurrency(currency)` — emailing **someone else's** record (cron, webhook, admin action):
  ZAR → `.co.za`, else `.online`.
- `appBaseUrl()` — the last resort when you have neither host nor recipient. Folds the two env vars
  (`NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_BASE_URL`); not yet region-aware.

**Never hardcode `https://life-therapy.co.za`.** The `NEXT_PUBLIC_APP_URL` override in
`getBaseUrlForRegion` is **non-production only** — in prod it would send every international client's
links to `.co.za`, because there is one env scope for both domains. The audit's `dual-domain` check
forbids the literal outside `lib/region.ts`/`lib/copy.ts`/`app/layout.tsx`.

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

## Environment access — `lib/env.ts` is the only reader of server vars

A var read raw at its point of use is discovered MISSING only there, mid-request. `lib/env.ts`
declares every server var once and reads it through a validating accessor:

- `env(name)` — the value or `undefined` (typed name; a typo won't compile).
- `requireEnv(name)` — the value or a **named throw** (fail-closed).
- `envOr(name, default)` — genuine config with a default.
- `isConfigured(...names)` — an integration is on only if ALL its vars are set (a half-set one reads
  as off, never as a mid-request error).
- `missingRequiredEnv()` — the required set that's absent; asserted once/day from the daily cron.

Rules:
- **Server vars go through `lib/env.ts`.** The `env` audit check forbids raw `process.env.<SERVER_VAR>`
  elsewhere. Exceptions (allowlisted): the Supabase/Prisma client constructors (hard deps, guarded at
  construction), and `CRON_SECRET`/`AUDIT_IP_HMAC_KEY` (their own single guarded readers).
- **`NEXT_PUBLIC_*` stays a literal `process.env.NEXT_PUBLIC_X`** — the Next.js compiler inlines it into
  the client bundle, which only works on a literal member-access. Routing it through a function leaves
  `undefined` in the browser. These are client-safe by definition.

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
CRON_SECRET                       — cron auth. ONE reader: lib/cron/with-cron-run.ts. Headers only.
AUDIT_IP_HMAC_KEY                 — keys the IP hash in the audit trail (any long random string)
```

> **`AUDIT_IP_HMAC_KEY` is new.** Without it, `recordAuthEvent` still records the event but omits the
> IP hash entirely, and logs an error. It refuses to write an unkeyed hash: IPv4 is only 2^32 values,
> so an IP "hashed" with a key anyone can read is reversible by brute force in minutes — a column that
> looks protected and isn't is worse than storing the raw IP.
>
> **`CRON_SECRET` is headers-only.** The query-string path (`?secret=`) was removed: it put a live
> credential into Vercel access logs and browser history. Trigger a job by hand with a header:
> `curl -H "x-cron-secret: $CRON_SECRET" https://life-therapy.co.za/api/cron/daily`

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

**Where does a rule belong?** Ask what it costs the day the model ignores it once.

| Cost of ignoring it once | Where it lives |
|---|---|
| Annoyance — a style slip, a re-run | `CLAUDE.md`. Prose is advisory, and that is fine here |
| **Incident** — wrong money, a client emailed, data unrecoverable | A **check**, or a hook |

Prose is read attentively on day one and skimmed by the twentieth session — and it is not read at
all by a subagent that was handed a narrow task. Anything incident-class has to be mechanical, or
it is being enforced by whoever happens to be paying attention.

The two layers catch different things, so use both. A **hook** fires at write time and refuses;
a **check** fires at `npm run check` and can see the whole tree at once. On 2026-08-18 a scripted
edit silently failed to apply: the function signature changed and its guard did not. `tsc`, ESLint
and 173 tests all passed — a throw is perfectly legal code — and the *audit* caught it on the next
run by naming the exact string still being thrown. A hook could not have seen it.

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

`ddl-gate.js` is the second hook, on `Write|Edit`. It asks before a FILE is written that applies
DDL to production through the Management API. `bash-gate` already asks when that URL appears in a
*command* — but the documented way to run anything needing real credentials is
`npx tsx --env-file=.env.local <script>`, which puts the URL in the file and leaves the command
line indistinguishable from any other script run. Five schema changes reached production that way
on 2026-08-18 without the gate firing once. Asking at the point the statement is *written* is also
the point a human can still read it. It asks, never denies — this is the working path for schema
changes, it just must not be silent. A `SELECT` through the same endpoint stays quiet.

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
