# Centralisation Audit — what's decentralised that shouldn't be

**Date:** 2026-07-12 · **Method:** three parallel pattern sweeps across `lib/` + `app/` + `components/` (excl. `lib/generated/`, tests), every count classified per-site and the top findings independently verified against the working tree at `master` (`8d5259a`).
**Doctrine borrowed from:** the Pleks centralisation audit (2026-07-09), whose lessons transferred almost verbatim.

---

## Doctrine first

**Centralise + lint, or it decays.** A centralisation without an enforcing rule is a suggestion; with one, it's an invariant. This codebase proves both halves in the same week: the date SSOT (`lib/dates.ts`) held *because* `scripts/architecture-audit.mjs` guards it — the sweep re-ran all 15 checks and found zero surviving bypasses of the five patterns it knows. Everything not guarded by a check rotted.

**Three of the twelve findings below are SSOTs that already exist and are simply bypassed** — `lib/phone.ts`, `formatPrice`, `sendEmail`'s fallback contract. That is the Pleks thesis reproduced exactly: *a centre without a rule decays even when it exists*. The fix therefore ships as **helper (usually existing) + migrated call sites + a check that forbids the raw pattern**. The check is the deliverable; the helper is often already written.

**A rule is only as honest as its pattern.** Two live demonstrations from this very sweep:
- The audit script's own cross-currency check knew the Prisma `_sum` spelling but not the JS `.reduce()` one, and sailed past seven aggregates in `lib/report-queries.ts`. It was also *file-level* — one `currency: "ZAR"` anywhere exempted every query in the file.
- The narrow URL pattern `https://life-therapy` finds 54 sites; the bare-domain pattern finds **126**. Sweep synonyms or you measure a false zero.

---

## Ranked findings

### 1 · Cron secret accepted as a `?secret=` query param — all 7 routes 🔴 security

`isCronAuthorised` (`lib/cron/with-cron-run.ts`) falls back to `new URL(req.url).searchParams.get("secret")`, and `app/api/cron/daily/route.ts` hand-rolls the identical check. A production credential in a URL lands in Vercel access logs, browser history and referrer headers. **This is the exact finding that forced a `CRON_SECRET` rotation on Pleks.** Six routes inherit it via the shared helper; `daily` — the orchestrator that runs the other nine jobs — duplicates it independently, so a fix to one silently misses the other.

Secondary: the compare is `===` (not constant-time). Low real-world exploitability over a network, but free to fix once the helper is the only reader.

**Fix:** header-only in `isCronAuthorised`; `timingSafeEqual`; delete `daily`'s copy and call the helper. **Check:** `process.env.CRON_SECRET` may appear in exactly one file. **Ops:** rotate `CRON_SECRET` — non-use by an ad-hoc caller is unprovable from logs.

### 2 · Four email templates have NO hardcoded fallback — a silent client-facing send failure 🔴 correctness

`renderFallback()` in `lib/email-render.ts` has cases for 22 keys. Four keys that are actually rendered have **none**: `booking_cancellation`, `booking_notification`, `booking_reminder`, `order_confirmation`. They fall to `default:` → subject `"Email: booking_cancellation"`, body `"<p>Template not found.</p>"`.

Masked today only because `lib/email-template-defaults.ts` seeds all four as active DB rows — and the admin UI lets anyone toggle `isActive` off. The moment that happens, real clients receive "Template not found" for a cancellation, **and `sendEmail()` still reports success**, so nothing alerts anyone. This is CLAUDE.md pitfall #6 ("template changes need TWO updates") failing in the direction nobody checked.

Galling detail: the fallback *functions* already exist in `lib/email-templates.ts` (`bookingCancellationEmail` et al.) — they just take a `Booking` object rather than `renderFallback`'s `Record<string,string>`, so nobody wired them up.

**Fix:** add the four cases. **Check:** cross-reference every `renderEmail("key")` literal against the `case "key":` labels; fail on any key with no fallback. Mechanical, and would have caught this the day it shipped.

### 3 · A client's own invoice page hardcodes `"R"` 🔴 correctness, client-facing

`app/(portal)/portal/(dashboard)/invoices/page.tsx` defines a local `formatCurrency(cents)` that returns `` `R ${…toLocaleString("en-ZA")}` ``. It takes **no currency argument**, and the word `currency` does not appear anywhere in the file. A USD/EUR/GBP client on life-therapy.online sees Rand symbols on their own invoices and payment requests.

Same class, four more sites: `lib/cron/whatsapp-reminders.ts` (`formatCents` — symbol-aware but `en-ZA` grouping, so a USD amount gets space-thousands), the admin Finance table rows, `new-pr-dialog.tsx` / `payment-request-dialogs.tsx` (`formatR`), and `cancel-booking-button.tsx` (which receives `priceZarCents` **with no `priceCurrency` prop at all** — CLAUDE.md pitfall #1, verbatim).

The SSOT is `formatPrice(cents, currency)` with **33 importers** — genuinely adopted, and the highest-stakes files (`generate-invoice-pdf.ts`, `send-invoice.ts`, `email-templates.ts`) all delegate to it correctly. This is a *tail*, not a rejection.

**Fix:** fold the seven local formatters into `formatPrice`. **Check:** ban `Intl.NumberFormat` / `toLocaleString(…style:"currency")` / any `function format(Currency|Cents|Money|R)` outside `lib/utils.ts`.

### 4 · `lib/audit.ts` hashes IPs with a fallback key checked into git 🔴 security

```ts
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "lt-auth-ip-fallback-key";
return createHmac("sha256", key).update(ip).digest("hex").slice(0, 16);
```

The docstring says *"Keyed HMAC (not a bare hash) so the small IPv4 space can't be reversed by rainbow table."* The fallback defeats precisely that: if the service-role key is ever unset (a preview deploy, a misconfigured env), every "hashed" IP becomes reversible by anyone with the repo — IPv4 is 2³² values. The guard silently degrades to no guard. It also *overloads* an unrelated secret as an HMAC key, which is its own smell.

**Fix:** a dedicated `AUDIT_IP_HMAC_KEY`, and **throw** if it's missing. A privacy guard must fail closed.

### 5 · Public booking creation sits on an in-memory rate limiter 🟠 security

`app/(public)/book/actions.ts` → `createBooking` is the most consequential unauthenticated write in the app: it takes a real slot on a finite calendar, fires a Graph event, sends emails. It's protected by `lib/rate-limit.ts` — an in-memory `Map`. **On Vercel each lambda instance holds its own counter**, so the effective ceiling is `10 × warm instances`, not 10/hr, and it resets on every cold start.

The durable limiter (`lib/rate-limit-db.ts`, backed by the `rate_limits` table) already exists and is used correctly by login and forgot-password. Two modules for one concept, applied inconsistently.

**Fix:** move `createBooking` (and `registerStudent`) to the DB-backed limiter. `app/api/cart/validate-coupon` has no limiter at all.

### 6 · Client-facing hardcoded domains — wrong-domain links reach international clients 🟠 correctness

The project has two domains (`.co.za` ZAR / `.online` international) and a region-aware resolver already exists (`getBaseUrlForRegion` in `lib/region.ts`). It is bypassed:

- `bookings/actions.ts` ×4 + `portal/bookings/actions.ts` — `bookUrl: "https://life-therapy.co.za/book"` hardcoded in **cancellation emails**. An international client who cancels is sent to the wrong site to rebook.
- `legal-documents/actions.ts` — `DEFAULT_BASE_URL` with no env fallback at all, feeding the portal link in an email sent to **every active client**.
- `api/certificates/download` — footer prints `life-therapy.online` unconditionally onto a **certificate a client downloads and keeps**, including SA clients.
- ~25 sites copy-paste `process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"`. The fallback is *always* `.co.za`, never region-derived. And two env vars (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`) are read for the identical purpose with no convention.

**Fix:** route through `getBaseUrlForRegion`/`getRegionCopy`. **Check:** ban the domain literal outside `lib/region.ts`, `lib/copy.ts`, `app/layout.tsx` (hreflang — legitimate), and the email preview samples.
**Landmine to verify in Vercel:** `getBaseUrlForRegion` returns `NEXT_PUBLIC_APP_URL` *before* its region branch. If that var is set globally rather than per-deployment, the region-awareness is dead on both domains.

### 7 · No `lib/env.ts` — 110 raw reads, 33 vars, 23 non-null assertions 🟠 the outage class

Every var is read raw at its point of use, so a missing or mis-scoped value is discovered deep in a request. `app/api/bunny/{upload,stream}/route.ts` re-read `BUNNY_*` with `!` **independently of `lib/bunny.ts`, which has a runtime guard they didn't copy** — if unset, the literal string `"undefined"` is baked into an upload URL returned to the browser. `lib/encryption.ts` is the model to copy: no `!`, no default, throws on a malformed key.

Eleven vars appear in exactly one place — a typo in any of them is undetectable.

**Fix:** `lib/env.ts` with one validated accessor per var and a startup assertion of the required set. **Check:** ban `process.env` outside it (allowlist `next.config.mjs`, `scripts/**`, tests).

### 8 · `daily/route.ts` duplicates the cron auth check 🟠 DRY, security-adjacent

Covered in #1, but worth its own line: it *already imports* from `lib/cron/with-cron-run.ts` and still re-implements the auth. Any future change to auth logic misses the highest-value endpoint in the system.

### 9 · `formatPhoneDisplay` is a rotted duplicate of the phone SSOT 🟡 DRY

`lib/phone.ts` exists, calls itself "single source of truth", is libphonenumber-backed, and all ten *write* paths use it correctly. `lib/whatsapp.ts` normalises at the choke point. This centre is in good shape — **except** `lib/utils.ts` still carries `formatPhoneDisplay()`, an older near-identical function, still imported by four admin display sites. Not a live bug (stored values are already E.164), but two functions doing one job, discoverable only by grep. The purest specimen of decay-in-waiting.

**Fix:** delete it; re-point to `formatPhone`. **Check:** ban `parsePhoneNumberFromString` outside `lib/phone.ts`.

### 10 · `autoActivatePayerIfNeeded` flips client status with no audit entry 🟡 evidence

CLAUDE.md names "client status changes" as an audited category, and `updateClientStatusAction` does it correctly. But a private helper in `clients/[id]/actions.ts` flips `clientStatus: "inactive" → "active"` in the billing-payer flow with **no `recordAudit` call** — sitting a few hundred lines from the one that does. Otherwise the audit centre is clean: **zero** raw `prisma.auditLog.create` bypasses, and `AuditInput.action` is a plain `string`, so nobody is structurally forced around the helper (unlike Pleks, where a too-narrow enum drove callers to raw inserts).

**Open question, not a defect:** portal (client-initiated) cancellations record no audit entry, unlike every admin one. Defensible — there's no admin to attribute, and the booking row carries `cancelledBy`/`cancelledAt` — but it should be a decision, not an oversight.

### 11 · Four "Resend" actions are unguarded 🟡 correctness

CLAUDE.md: *"Email sends have `.catch(console.error)` — never let email failures crash the request."* The audit script enforces this in `lib/cron/` only. In `app/**/actions.ts`, four sites are unguarded — `resendInvoiceFromListAction`, `resendPaymentRequestEmailAction`, `resendInvoiceAction`, `resendGiftEmailAction`. These are literally the button an admin clicks *after* something already failed; a throw gives them a raw framework error instead of a toast.

**Fix:** widen the existing `email-safety` check's walk root from `lib/cron/` to `app/**/actions.ts`. The machinery already exists.

### 12 · The audit script's own blind spots 🟡 meta

`server-action-auth` only walks `app/**/actions.ts`. It cannot see:
- **`app/api/**/route.ts`** (36 files). Swept manually — **all clean**, no unauthenticated admin route. But unguarded by the check.
- **Inline `"use server"` closures in `page.tsx`** (7 admin pages). All safe today (the dashboard layout is fail-closed and every closure delegates to a guarded action), but a future handler written directly in one would ship unguarded and unnoticed.
- **`lib/contacts.ts`** carries `"use server"` and calls `prisma.student.upsert` with no guard. Not exploitable today (all three callers are guarded, and no client component imports it), but the directive makes it an action endpoint in waiting. Drop the directive or add a guard.

---

## What is already correctly centralised (cite as the pattern)

`lib/dates.ts` (**the proof of the doctrine** — guarded by 6 checks, zero bypasses survive) · `sendEmail` (48 sites, one legitimate dev-script bypass) · `recordAudit` (zero raw bypasses) · `lib/phone.ts` (all write paths + the WhatsApp choke point) · `formatPrice` (33 importers; the PDF/email/invoice paths all delegate correctly) · `requireCronAuth` via `withCronRun` (6 of 7 routes) · `lib/encryption.ts` (the model for reading a secret) · `lib/rate-limit-db.ts` (on the two flows that matter most).

## Slicing

| Slice | Items | Why now |
|---|---|---|
| **1 — security** | 1 (cron secret + rotation), 4 (IP HMAC key) | Credential exposure; both are small, contained diffs. |
| **2 — silent client-facing failures** | 2 (missing fallbacks), 3 (portal "R") | Both reach real clients; both are latent-but-armed. |
| **3 — abuse surface** | 5 (durable limiter on booking), 12c (`contacts.ts` directive) | Real resource, real distributed-abuse exposure. |
| **4 — the dual-domain seam** | 6 (URLs), and verify the Vercel env landmine first | Wrong-domain links are live today for `.online` clients. |
| **5 — structural** | 7 (`lib/env.ts`), 11 + 12 (widen the audit's walk roots) | Prevents regeneration of the above. |
| **6 — tail** | 8, 9, 10 | DRY; cheap once the checks exist. |

Every slice = helper (new or existing) + migrated call sites + **a check in `scripts/architecture-audit.mjs`** + a `KNOWN_DEFECTS` entry if anything must wait. Baselines only shrink.

## The two lessons this audit banked

1. **The check is the deliverable.** Findings 2, 3, 9 and 10 are all centres that already existed and rotted because nothing forbade the raw pattern. Writing the helper again would fix nothing.
2. **Verify the probe fires.** The cross-currency check in the audit script was *green* over seven live bypasses in `report-queries.ts` because it knew one spelling and scoped per-file instead of per-query. A green light from a check that cannot fail is the most expensive artefact in the repo.
