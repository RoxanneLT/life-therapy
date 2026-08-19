# INTENTIONAL — deliberate design that looks like residue

**Every crawler reads this before reporting anything.** A finding matching an entry is
**suppressed, not downgraded**. `SPEC_CODEBASE_CRAWLERS` §6, and D6 makes it a build blocker:
without it a first run confidently flags considered decisions as defects, and first impressions
decide whether the tool is ever run again.

**Every entry carries its reason, not just its pattern.** A crawler handed a bare pattern list
finds the near-miss variant and flags that instead. This is the same rule the audit's allowlists
follow: an allowlist is a decision log, not a silencer.

**What does NOT belong here.** Anything a mechanism already decides. If a check, hook or lint rule
covers it, the crawler should never have looked — and if it did, the fix is to narrow the crawler,
not to add an entry. Entries here are for judgement-bound classes only.

**Exit condition.** An entry leaves when the design changes, or when the class becomes mechanically
decidable and moves to a check. An entry that can never leave is a rule, and rules live in
`CLAUDE.md`.

---

## Naming and shape

### `priceZarCents` holds cents in whatever currency the booking used

Misnamed by history, not by mistake. Always read alongside `priceCurrency`. Renaming it is a
migration across every booking, invoice and payment-request path; the name is documented at
CLAUDE.md §9 and the money checks enforce the currency-derivation rule regardless of the column
name. **A finding proposing the rename is out of scope; a finding that a call site reads it
WITHOUT `priceCurrency` is a real defect** — and belongs to the `money:` checks, not here.

### `emailPaused` is not a client preference

Set automatically by the cold-contact rule, never by a person. It means "we think they stopped
reading", not "they asked us to stop". Three tiers govern what it may suppress
(`lib/engagement.ts`); a finding that some sender "ignores emailPaused" is describing the design.

---

## Date and time

### `.slice(0, 10)` on a `@db.Date` column

Exact, not a UTC-day bug. A `@db.Date` is stored at UTC midnight and carries no time, so slicing
its ISO form yields the calendar day it represents. The bug class the date checks hunt is slicing a
real **instant** (`createdAt`, `paidAt`), where the SAST day turns over at 22:00 UTC.

### Two Graph call sites slice a datetime string

`lib/graph.ts` and `lib/calendar-reconcile.ts` send `Prefer: outlook.timezone="Africa/Johannesburg"`,
so Graph returns SAST-local strings and slicing them is correct. Both are named in the audit's
`DATE_ALLOWLIST` with this reason, and that allowlist is itself probed — an entry that stops
suppressing anything fails the build.

---

## Region and URLs

### The `NEXT_PUBLIC_APP_URL` override is non-production only

Production serves both domains from one deployment and decides region per request from the
hostname. There is one env scope for two domains, so honouring the override in production would
send every international client's links to `.co.za`. The asymmetry is load-bearing: a finding that
"the override is inconsistently applied" is attacking the invariant.

---

## Email

### Two layers of templates, DB first and hardcoded second

`EmailTemplate` rows are checked before the hardcoded fallbacks in `email-render.ts`. This is not a
half-finished migration — the fallback layer is what keeps mail sending when a row is missing or
deactivated, and a check asserts every rendered key HAS a fallback. A finding proposing removal of
either layer is proposing an outage.

### External links in emails are deliberately untracked

The click redirector forwards only to our own hosts. `injectTracking` therefore leaves foreign
links alone rather than wrapping them, so a Teams or Paystack link goes out untracked. Losing a
click statistic beats losing the click — the alternative shipped once and clients reached
`{"error":"Untrusted URL"}` instead of their session.

---

## Rate limiting

### `rateLimitApi` is in-memory on serverless, knowingly

Per-process, so it resets on cold starts and an attacker's real budget is per-lambda. It guards two
read-only availability endpoints where it is coarse politeness, not abuse prevention. Everything
security-critical uses the durable `lib/rate-limit-db.ts`. The weakness is stated at the site; a
finding that "the rate limiter is ineffective on serverless" is repeating the comment. **A finding
that a NEW security-critical path uses it is a real defect.**

---

## Validation

### Seven zod schemas in `lib/validations.ts` have no callers

`loginSchema`, `siteSettingsSchema`, `availabilityOverrideSchema`, `bookingSettingsSchema`,
`quizQuestionSchema`, `couponSchema`, `studentLoginSchema`. Their paths DO validate, by hand,
beside them. They are tagged `@queued` at their own sites: the intended resolution is to **adopt
them at the call sites**, not delete them, and that changes validation behaviour on seven admin
forms. A finding saying "unused schema, delete it" has the resolution backwards. **A finding
identifying a specific hand-rolled check that the schema would do better is exactly what is
wanted.**

---

## Owned debt

### `KNOWN_DEFECTS` entries in the audit

Real, classified bugs, parked so unrelated work is not blocked. Each entry fails the build if it
stops firing, so none can outlive its bug. Not residue, not oversight — a register with a ratchet.
A finding re-reporting one of these is re-reporting a decision.

### The duplication register

`DUPLICATE_BODIES_KNOWN` carries per-entry reasoning, and two entries are kept **deliberately**:
the file-upload and image-upload handlers are identical today and expected to diverge, because an
image dropzone wants validation a generic one must not impose. Collapsing them would build a shared
function with two callers pulling in opposite directions, which is worse than the copy.

---

## The repository itself

### The repo lives outside OneDrive, and that is a hard invariant

Not a preference and not a leftover. A sync layer and a content-addressed store cannot own the same
bytes: 118 git objects became unreadable and a working day was lost. The installer refuses any path
containing "onedrive". The secrets folder is the deliberate inverse — it carries ONLY what git
ignores.
