# CLAUDE.md — Life-Therapy Platform

<!--
  Built from SPEC_CLAUDE_MD_STANDARD v4.3.
  BINDING METRIC: the UNENFORCEABLE count — rules whose only control is model
  attention. `npm run audit` prints it. It may only fall.
  ADVISORY: ~250 visible always-loaded lines. A tripwire for a ratchet pass —
  never a reason to relocate prose. Aperture decides location; the count decides
  urgency.
  MARKERS (§4 "Enforced" and §5 may contain ONLY marker-carrying bullets):
    @enforced <ns:control-id>        → HTML comment, invisible, free (E2)
    UNENFORCEABLE + reason           → VISIBLE prose; attention is the only control
  EXPERIMENTS — all four answered in THIS harness, 2026-08-18. Re-run in a new one.
    E1  paths: frontmatter defers loading        — YES. Cross-session A/B, one
        variable: schema-changes.md was in context at launch without frontmatter,
        absent from a fresh session with it.
    E1b scoped rules trigger on edit-without-read — NO. Read of a matching file
        injects the rule; Write to a new matching path does not. RUNG 4 IS NEVER
        A CONTROL — it reaches the session that reads before it writes and misses
        the one that doesn't.
    E2  HTML comments stripped                    — YES for a comment alone on its
        line (canary absent, surrounding lines intact). Inline @enforced tags at
        the END of a prose line DO survive. Never reformat one onto its own line.
    E3  CLAUDE.md reaches subagents                — YES, positive-with-
        transcription. An earlier probe reported the opposite and was wrong; see
        docs/LESSONS.md L-012. They receive it and skim it.
  Full contract: SPEC_CLAUDE_MD_STANDARD v4.3. Lessons: docs/LESSONS.md.
-->

## 1 · START HERE

**The repo lives OUTSIDE OneDrive.** That is the invariant; the drive is per-machine.
Don't hardcode `C:\dev` anywhere, and don't guess the desktop's. Why this is a rule and
not a preference: §6, 2026-08-17.

| Machine | Path |
|---|---|
| Laptop | `C:\dev\life-therapy` (alongside `C:\dev\pleks`) |
| Desktop | **not yet decided** — C/D/E/F; the working volume is a Windows Storage Space (RAID-10), one of the others is OneDrive. Deliberately blank rather than guessed. **Write the chosen path here at setup** so the next session doesn't ask again. |

**First moves, before touching code:**

```bash
git status          # never assume this machine is current
git fetch && git log --oneline HEAD..origin/master   # what landed elsewhere?
git pull            # another machine may have pushed
npm run secrets     # are .env.local etc. in sync with OneDrive?
```

`git status` first is not a formality: a second machine may have pushed, and a stale local
copy here silently reintroduces fixed bugs.

**Then skim `docs/LESSONS.md` for open items naming this project.** A propagation ledger
nobody reads where the work happens is a status line with extra distance.

**Session state:** `docs/SESSION_HANDOVER_2026-08-17.md` — what was fixed, the DDL already
live in production, the open TODO list in priority order, and which claims were reasoned
rather than demonstrated. It survives compaction because it is on disk.

### A machine that has never had the repo

The bootstrap problem is solved: a fresh machine has no working folder, because the repo no
longer arrives by sync. The one thing that *does* still arrive is the secrets folder, so the
installer lives there.

> **`~/OneDrive/dev-secrets/life-therapy/SETUP-NEW-PC.ps1`** — right-click → *Run with
> PowerShell*. It **asks where to put the repo**, listing drives and free space, then clones,
> runs `npm ci`, copies secrets into place and runs `npm run check`. Safe to re-run.
> `README.txt` beside it explains the layout.
>
> Skip the prompt — the desktop case: `.\SETUP-NEW-PC.ps1 -RepoPath 'E:\dev\life-therapy'`
>
> It **refuses any path containing "onedrive"**, which is the mistake it exists to prevent.

By hand, substituting your own drive:

```bash
git clone https://github.com/RoxanneLT/life-therapy.git <YOUR-PATH>\life-therapy
cd <YOUR-PATH>\life-therapy
npm ci                 # postinstall runs `prisma generate`
npm run secrets:pull   # brings .env.local, .env, .claude/settings.local.json
npm run check
```

### The secrets channel

Git deliberately does not carry `.env.local`, `.env` or `.claude/settings.local.json`. They
live in `~/OneDrive/dev-secrets/life-therapy` and move with `scripts/sync-secrets.mjs`:
`npm run secrets` (status only) · `secrets:pull` (OneDrive → here, after a clone or when the
other machine changed a key) · `secrets:push` (here → OneDrive, after YOU change one).
`LT_SECRETS_DIR` overrides the location.

> If you find yourself in `C:\Users\stean\OneDrive\Websites\Life Therapy`, stop. That is the
> retired copy and its `.git` is damaged. Move to the real one.

---

## 2 · WHAT THIS PROJECT IS, AND HOW TO REACH ITS SYSTEMS

Life-Therapy is an online counselling and life-coaching platform: **Next.js (App Router)**,
**Prisma** on PostgreSQL, **Supabase Auth**, **Paystack**, deployed on **Vercel**. Admin
manages clients, bookings, billing, courses, digital products and email. Clients get a portal
for bookings, session history, course content and invoices.

Two domains, **one deployment**, region decided per-request from the hostname:
`life-therapy.co.za` (SA, ZAR) and `life-therapy.online` (international, USD/EUR/GBP).

**Reaching the systems — query them directly rather than asking for pasted output:**

| System | How |
|---|---|
| Production DB | **Management API over REST** (`SUPABASE_ACCESS_TOKEN` from `.env.local`). The Supabase **MCP tools do not work here** — every call, even a read-only `list_tables`, returns `MCP error -32600: You do not have permission`. Reads as much as DDL. |
| One-off scripts | `npx tsx --env-file=.env.local <script>` — ESM hoists imports above `dotenv.config()`, and `.env` holds a `johndoe@localhost` placeholder `DATABASE_URL` |
| Deploys, build logs, runtime errors | Vercel MCP (read-only calls pre-allowed) |
| PRs | GitHub MCP (read-only calls pre-allowed) |

---

## 3 · THE GATES

| Gate | Command |
|---|---|
| Before every commit | `npm run check` |
| Before every push | `npm run check`, then wait to be asked |
| Before every deploy | Vercel builds from `master`; there is no separate deploy step |

**Push policy: never push.** Commit, report, and wait. Stéan walks and visually checks the
work before it goes out. This is a standing rule, not a formality.

`npm run check` is a gauntlet, not a typecheck:

```
tsc --noEmit
  && eslint . --max-warnings 0        ← warnings are errors; they never accumulate
  && node scripts/architecture-audit.mjs
  && npm run test:gate                ← probes for the bash gate itself
  && npm run test                     ← lib/*.test.ts
```

Pieces: `npm run typecheck` · `npm run lint` · `npm run audit` · `npm run test:dates` ·
`npm run test:gate` · `npm run test:removal`. Run the whole thing after each logical change,
not after ten.

**Hook-denied** (precise patterns — the smart layer, `.claude/hooks/bash-gate.js`):
`git push --force` · `git reset --hard` · `rm -rf` on `/` or `~` · `prisma migrate` /
`prisma db push` (they do not work here — see `.claude/rules/schema-changes.md`).
Reading `.env*` is denied at the settings layer.

**Hook-asks:** `git push` · any SQL through the Management API · `vercel`.

**Settings-ask twins** (coarse patterns — **dormant while the hook lives**, consulted only
when it is dead): every gate above names its twin inline as `// @twin`. Reconciled by
`hooks: every incident-class gate has a settings twin`, which also checks each twin's probe
record and fails if the rule it covers has been edited since.
<!-- @enforced audit:hooks-every-incident-class-gate-has-a-settings-twin -->

`ddl-gate.js` is the second hook, on `Write|Edit`. It **asks** before a file is written that
applies DDL to production. `bash-gate` already asks when that URL appears in a *command* — but
the documented way to run anything needing real credentials puts the URL in a file and leaves
the command line indistinguishable from any other script run. Five schema changes reached
production that way on 2026-08-18 without the gate firing once. Asking at the point the
statement is *written* is also the point a human can still read it. It asks, never denies; a
`SELECT` through the same endpoint stays quiet.

Approval-gated actions sequence to the **end** of a task. The gates are load-bearing — do not
engineer around them.

---

## 4 · WHERE THE RULES LIVE

Inventory and documentation status live **in the audit** (`documented:` flags at each
control's site), never as a per-control list here — a list here would grow with every control
added, inside the file with a budget.

| Family | Where |
|---|---|
| ESLint | `eslint.config.mjs`, `--max-warnings 0` |
| Audit checks | `scripts/architecture-audit.mjs` — each named after the bug class it catches |
| Hooks + twins | `.claude/hooks/bash-gate.js`, `ddl-gate.js` + `.claude/settings.json` |
| Tests | `lib/*.test.ts`, `.claude/hooks/bash-gate.test.mjs` |
| Commands | `/walk` (adversarial review of the diff vs `origin`) · `/wrap` (session close; **does not push**) |
| Rule files | `.claude/rules/schema-changes.md` — why `prisma migrate` fails here (the pgbouncer pooler) and the Management API path that works |

`.claude/rules/*.md` carries `paths:` frontmatter and is **guidance only, never the sole
holder of incident-class content** — E1b: read-triggered, so an edit-blind session gets none
of it. `schema-changes.md` is scoped only because `bash-gate` denies the dangerous command
unconditionally; the prose may leave context because the protection does not.

**Where a new rule goes — what does it cost the day the model ignores it once?**

| Cost | Where it lives |
|---|---|
| Annoyance — a style slip, a re-run | Prose. Advisory, and that is fine |
| **Incident** — wrong money, a client emailed, data unrecoverable | A hook (one tool call's aperture, reaches every context) and/or a check (whole-tree aperture, catches what lands anyway), plus a settings twin at `ask`, plus probes |

The two layers catch different things, so use both. On 2026-08-18 a scripted edit silently
failed to apply: a function signature changed and its guard did not. `tsc`, ESLint and 173
tests all passed — a throw is perfectly legal code — and the *audit* caught it by naming the
exact string still being thrown. A hook could not have seen it. Conversely a check cannot stop
anything landing.

**Probe first, both directions, before version one.** A planted violation must **fail**, and a
known-good case must **pass**. The second half is the load-bearing one: a suite that only
plants violations cannot tell a working check from one that never matches, and a
never-matching pattern reports 100% violations — tool failure and catastrophic finding are the
same output. The `+02:00` check silently never fired until a planted probe exposed that it was
scanning comment-stripped source, where string literals — the only place an offset ever lives
— had already been removed. Probes cannot travel through the channel the control inspects:
the gate's fixtures name the commands it blocks, so they live in a file on disk.

If a rule concerns **one file**, it goes in that file as a comment, not here. Reasoning splits
by subject: *why this change* → commit message; *why the code has this shape*, false leads
included → comment at the site, because the next reader won't run blame.

**Precedence.** Mechanisms enforce; they don't assert. Prose contradicting a green check is
stale prose — report it, don't act on it. Hook-permits vs check-forbids → the check governs;
file a finding against the hook. `KNOWN_DEFECTS` entries are owned debt — real, classified
bugs parked so unrelated work isn't blocked, while any *new* finding fails the build. The list
may only shrink, and the audit fails if an entry stops firing, so it can't outlive its bug.
Never fix one inside unrelated work.

**Allowlists are decision logs, not silencers.** `ZAR_BY_CONSTRUCTION` and
`REVALIDATE_EXCEPTIONS` carry a reason per entry. A false positive is resolved by an
allowlist **entry**, never by closing the finding — otherwise it returns next month, gets
re-investigated by someone with less context, and eventually gets "fixed", which is how a
deliberate asymmetry becomes a bug. Exemptions are probed too: `allowlists: every exemption is
still load-bearing` fails when an entry stops suppressing anything. A stale exemption is worse
than a missing one — it reads as a considered decision and silently covers whatever is written
into that file next.

### Enforced

<!-- Marker-carrying bullets only. A marker-less bullet here fails the audit. -->

- **Never hardcode prices, rates, or currency.** Read from `SiteSetting`, `BillingPreset`, or the booking's stored price/currency — and derive the currency from `priceCurrency`, the student's region, or the PaymentRequest's `currency`. Never assume ZAR. <!-- @enforced audit:money-no-hardcoded-currency-in-business-logic -->
- **Never hand-roll a date.** No `new Date(y, m, d)`, no `.toISOString().slice(0, 10)` on a timestamp, no `format()` for display, no hardcoded `+02:00`. Everything goes through `lib/dates.ts` — §9. <!-- @enforced audit:date-safety-no-local-midnight-date-constructors --> <!-- @enforced audit:date-safety-no-iso-slicing-a-real-instant --> <!-- @enforced audit:date-safety-no-hardcoded-02-00-offset -->
- **Never push.** Commit, report, and wait. <!-- @enforced hook:bash-gate --> <!-- @enforced settings:ask-git-push -->
- **Never use `any` types.** Use proper Prisma types or define interfaces. <!-- @enforced eslint:@typescript-eslint/no-explicit-any -->
- **Use `requireRole("super_admin", "editor")` on every server action** that modifies data. Read-only actions can use `requireRole("super_admin")` alone. <!-- @enforced audit:server-action-auth-every-mutating-action-is-guarded-for-its-route-group --> <!-- @enforced audit:server-action-auth-mutating-api-routes-and-inline-actions-are-guarded -->
- **Use `revalidatePath()` after every mutation** to refresh the relevant page data. <!-- @enforced audit:mutation-revalidate-every-mutating-action-calls-revalidatepath -->
- **Return refusals a human will read; never throw them.** Next.js strips a thrown message in production and shows React's digest instead — so the reason, the one thing they needed, is the one thing they can't see. <!-- @enforced audit:server-action-ux-a-refusal-a-human-reads-is-returned-not-thrown -->
- **Use `formatPrice(cents, currency)`** for all currency display — never manual string concatenation. <!-- @enforced audit:money-formatprice-always-passes-a-currency --> <!-- @enforced audit:money-no-local-currency-formatter -->
- **A cancel path removes the calendar event**, and the removal's shape is decided by counting who holds the `graphEventId` — never by `recurringSeriesId`. `lib/calendar-removal.ts`. <!-- @enforced audit:calendar-a-cancel-path-removes-the-calendar-event --> <!-- @enforced audit:calendar-removal-shape-is-not-inferred-from-recurringseriesid -->
- **Server vars go through `lib/env.ts`** — `env()`, `requireEnv()`, `envOr()`, `isConfigured()`, `missingRequiredEnv()`. A var read raw at its point of use is discovered missing only there, mid-request. Allowlisted exceptions: the Supabase/Prisma client constructors (hard deps, guarded at construction) and `CRON_SECRET`/`AUDIT_IP_HMAC_KEY` (their own single guarded readers). **`NEXT_PUBLIC_*` stays a literal `process.env.NEXT_PUBLIC_X`** — the compiler inlines it into the client bundle, which only works on a literal member access. <!-- @enforced audit:env-no-raw-process-env-for-a-server-var-outside-lib-env-ts -->
- **A confirm action is never nested inside the dialog it dismisses.** <!-- @enforced audit:confirm-dialogs-a-confirm-action-is-not-nested-inside-the-dialog-it-closes -->
- **Never hardcode `https://life-therapy.co.za`.** §9, URLs. <!-- @enforced audit:dual-domain-no-hardcoded-life-therapy-domain-in-a-client-facing-path -->
- **Never hard-delete an irreplaceable record** — a booking, student, invoice, payment request, credit ledger row, order or admin user. Soft-delete: status flags, `isActive: false`, `archivedAt`. CMS and catalogue rows are not covered; removing a page or a coupon is ordinary admin work. Deliberate exceptions live in `HARD_DELETE_ALLOWED` with the reason each one is different. <!-- @enforced audit:data-safety-an-irreplaceable-record-is-never-hard-deleted -->
- **Record an audit entry for the audit-worthy mutations** — billing type changes, booking cancellations, payment recording, invoice voiding, client status changes, discount changes. That list is a business judgement nothing can infer, so it is written into the check; extend it rather than re-deriving it. <!-- @enforced audit:audit-trail-an-audit-worthy-action-records-one -->
- **Never send an email, generate a PDF, or create a payment link in a "save" action.** Those happen when the user clicks Send. Where saving and sending genuinely are one act, `SAVE_SIDE_EFFECT_ALLOWED` says why. <!-- @enforced audit:side-effects-a-save-action-does-not-reach-the-outside-world -->

---

## 5 · DOCTRINE THE MACHINE CANNOT HOLD

These have **no mechanical net**. Nothing will catch a violation, so they are held by
attention alone — they are the ones to slow down for. Everything in §4 is enforced; follow it
and the build disagrees with you if you don't. Mechanise one of these and it moves up to §4,
and the count below falls, which is the point.

- **Read the actual source files before writing code.** Don't assume structure — this codebase has specific patterns. Read the component, its imports, and the actions file first. UNENFORCEABLE — and it is the root of most of the rest: every rule here is easy to satisfy once you have read the file and impossible to satisfy reliably from memory. Reading is also what summons the scoped rule files (E1b).
- **Never create parallel systems when you can extend existing ones.** Manual invoices reuse the pro-forma → Paystack → tax-invoice pipeline; they don't build a second invoicing flow. UNENFORCEABLE — "is this a duplicate system" is a judgement about intent. Ask `grounder` before building.
- **Never modify the Prisma schema without being explicitly told to.** If you think a change is needed, describe it and wait. An approved one goes through the Supabase Management API. UNENFORCEABLE — nothing can tell an approved change from an invented one. (The `migrate` path itself *is* blocked, at the hook and in the audit; that half is in §4.)
- **Never auto-fill or guess client data.** If a field needs a value you don't have, leave it empty or show a placeholder. UNENFORCEABLE — a fabricated value is indistinguishable from a real one at the point it is written.
- **Use `toast` from `sonner` for success and error feedback** on client-side actions. Silence reads as success — a cancelled session sat live in Outlook for five days behind a dialog that closed without a word (§6). UNENFORCEABLE, and measured on 2026-08-18 rather than assumed: "did this report the outcome" has no code shape. 47 of 197 client components import an action without importing `toast`, and most are right to — a form that redirects, a component with inline errors, one that reports via `alert()`. Narrowing to the incident shape (a confirm dialog whose action reports nothing) left 4, of which some were fine. Any check here either misses real cases or flags files that are correct.
- **Use confirmation dialogs for destructive actions** — cancel, void, delete, send. UNENFORCEABLE, and the census shows why: the count moves from 12 to 18 depending purely on whether a `<Dialog>` counts as a confirmation alongside `<AlertDialog>`, and a two-step button or an inline "are you sure" counts too. A number that unstable is measuring the detector, not the codebase.

---

## 6 · SCARS

<!-- Outside any budget. Un-mechanised scars keep their narrative. Once mechanised: narrative
     moves to a comment at the site it concerns and one citation line stays here. -->

- **2026-08-17 · OneDrive ate the repo.** Cost: a working day, and finished work that could
  not be shipped. `node_modules` became a field of unreadable cloud placeholders — `npm`
  itself could not run — and then **118 git objects went unreadable**: `git fsck`,
  `git rev-list` and `git push` all failed with `mmap failed: Invalid argument`. Thousands of
  tiny files, placeholder hydration, and two machines writing pack files independently are
  what break it. Syncing the *code* was never the problem; syncing the *repo internals* was.
  **Git syncs the code. OneDrive syncs only what git ignores.** No single site — it stays
  narrative here. Mechanised only at the installer, which refuses any path containing
  "onedrive".

- **2026-08-18 · A cancelled session stayed live in Teams.** Cost: a client kept a meeting
  invite for a session cancelled five days earlier. The cancel action on the client detail
  page never mentioned the calendar at all — no Graph call, and no `calendar_sync_logs` row to
  show for it, on a table with 1,123 rows. Not a wrong branch: a **missing** one, in a file
  whose siblings all had it, which is why no reviewer reading a diff would see anything odd.
  The tell was an absence in the database. → `audit:calendar-a-cancel-path-removes-the-calendar-event`
  · narrative at `lib/calendar-removal.ts`

- **2026-08-18 · The delete dialog that took the form down with it.** Cost: every delete in
  the admin UI silently did nothing, for the life of the feature. `AlertDialogAction` closes
  the dialog on click, which unmounts `AlertDialogContent` — and the `<form>` was inside it, so
  the submission never completed. The dialog stated exactly what it was about to do and then
  did nothing. Proof was again an absence: zero `booking_deleted` audit rows, on an action that
  writes one *before* it deletes. → `audit:confirm-dialogs-a-confirm-action-is-not-nested-inside-the-dialog-it-closes`
  · narrative at `app/(admin)/admin/(dashboard)/bookings/[id]/page.tsx`

- **2026-08-18 · The gate denied its own commit.** Cost: a blocked commit, and a hole found.
  A wrapped line in a commit message began with a gated command, and `\n` is a command
  separator — so a heredoc *describing* the rule read as invoking it. The scar records this
  being fixed once, for the inline case; the multi-line door stayed open and the same bug came
  back through it a day later. → `.claude/hooks/bash-gate.test.mjs`
  · narrative at `.claude/hooks/bash-gate.js`

- **2026-08-18 · Five schema changes reached production ungated.** Cost: five unreviewed DDL
  statements. The gate matched on how the target appeared in a *command*, and the documented
  path supplies it by reference (`--env-file`), inside a file. → `.claude/hooks/ddl-gate.js` ·
  general form in `docs/LESSONS.md` L-001

- **Dates: every date bug this codebase has had** came from confusing a calendar *day* with a
  real *instant*. Full doctrine in §9. → three `date-safety:` checks · `npm run test:dates`

---

## 7 · AGENTS

| Agent | For | Access |
|---|---|---|
| `grounder` | **Before writing any code.** Maps the machinery a task touches so you extend it instead of duplicating it | read-only, sonnet |
| `census` | Repo-wide counts, find-all-usages, pattern audits — returns **classified** hits, not file dumps | read-only, sonnet |
| `db-inspector` | Live-data claims against production; every answer carries the query behind it | read-only, SELECT, sonnet |
| `implementer` | A pre-scoped mechanical transform; returns misfit judgment sites rather than guessing | write, `isolation: worktree`, never commits, sonnet |
| `walker` | Adversarial pre-push review — tries to **refute** the work. Independent context is the point | read-only, opus |

Mechanical reading → the read-only three. Mechanical writing → the isolated implementer.
Judgment stays in the main session. Proposers get worktrees; verifiers need `node_modules` and
the main checkout.

Subagents **do** receive this file (E3) — but a narrow-task agent skims it, and rung-4 files
never reach an edit-blind session (E1b). Presence is not enforcement, which is why the
incident class lives at hooks and checks.

**Classify per site, never sweep.** A pattern that looks uniform usually isn't — during the
date centralisation, two call sites identical to twenty-five others were correct for a reason
invisible to the regex. Blanket codemods break production.

---

## 8 · SESSION HYGIENE

**Anchor grounding claims** to the SHA read. *Does X* → anchor, past tense. *Should X* → no
anchor. An unanchored observation is itself a finding. An anchored one killed its own author's
wrong diagnosis here: a commit SHA disproved a claim that a code path was broken.

**Whole-file reconciliation** on any status correction — grep `awaiting`, `TODO`, `- [ ]`,
and settle all of them or say why not. A partially-fixed file looks reviewed, which is worse
than one that doesn't. This includes handover docs, LESSONS entries and probe records.

**Verify before you tick.** A commit message proves attempt, not landing. **Re-read after a
scripted edit** — four silently failed to apply in one session, and two were caught only
because a count was byte-identical before and after.

**Citations verified, not plausible** — a zero-hit grep is the check.

**Commit ≠ push.** One coherent revertable change; interdependent files together; unrelated
concerns split with `git add -p`; amend un-pushed fixes rather than piling `fix: oops`; pushed
commits are immutable, so fix forward.

**Ambiguous spec, or spec-vs-code conflict:** flag it and stop. Do not implement around it.

---

## 9 · PROJECT SLOTS

### SSOTs — never restate a value here

| What | File |
|---|---|
| Server env vars | `lib/env.ts` (`REQUIRED_IN_PROD`, `OPTIONAL`, each with its reason) |
| Dates & timezone | `lib/dates.ts` |
| Site config | `lib/settings.ts` — `getSiteSettings()` |
| Region / currency | `lib/region.ts`, `lib/pricing.ts` |
| Session types, slots | `lib/booking-config.ts` |
| Calendar removal | `lib/calendar-removal.ts` |
| Schema | `prisma/schema.prisma` |

### What does not live in code

> **`CRON_SECRET` is headers-only.** The query-string path (`?secret=`) was removed: it put a
> live credential into Vercel access logs and browser history. Trigger a job by hand with
> `curl -H "x-cron-secret: $CRON_SECRET" https://life-therapy.co.za/api/cron/daily`
>
> **`AUDIT_IP_HMAC_KEY` refuses to write an unkeyed hash.** Without it `recordAuthEvent` still
> records the event, omits the IP hash, and logs an error. IPv4 is only 2^32 values, so an IP
> "hashed" with a key anyone can read is reversible by brute force in minutes — a column that
> looks protected and isn't is worse than storing the raw IP.
>
> **The Graph vars are `MS_GRAPH_*`, not `GRAPH_*`** — mis-documented once, and it cost a
> debugging session.

### Layout

```
app/
  (admin)/admin/(dashboard)/   ← Admin pages (auth + role check)
  (public)/                    ← Marketing, booking, login
  (portal)/portal/             ← Client portal (student auth)
  api/                         ← Webhooks, downloads, cron triggers
  auth/callback/               ← Supabase auth callback
components/   admin/ · public/ · portal/ · ui/ (shadcn primitives)
lib/
  billing.ts                   ← VAT/discount calc, rate lookup, billing contact resolution
  billing-types.ts             ← InvoiceLineItem + zod parsing
  generate-payment-requests.ts ← Monthly billing run (postpaid)
  generate-invoice-pdf.ts      ← jsPDF invoice + pro-forma
  send-invoice.ts              ← Payment-request and invoice emails
  email-render.ts              ← Template rendering (DB first, hardcoded fallback)
  email-templates.ts           ← Hardcoded templates + base wrapper
  graph.ts                     ← Microsoft Graph (calendar, Teams)
  credits.ts                   ← Session credit balance, deduct, forfeit
  cron/                        ← Scheduled processors (billing, reminders, follow-ups)
```

### Patterns

**Server actions** live in `actions.ts` co-located with their page: `requireRole` first,
mutation, `revalidatePath`, return. **Pages are server components** that fetch and pass props;
interactive parts extract into `"use client"` components using `useActionState` or
`useTransition`.

**Emails are two-layer**: DB templates (`EmailTemplate`, editable by admin) checked first,
hardcoded fallbacks in `email-render.ts` → `email-templates.ts` second. Variables are
`{{name}}` placeholders; the call site pre-computes HTML blocks and passes them as strings.
A template change needs **both** updated if a DB row exists and is active.

**Postpaid billing:** monthly cron → `generateMonthlyPaymentRequests()` creates PaymentRequest
records with line items → `sendPaymentRequestEmail()` sends email + pro-forma PDF →
reminder/due-today/overdue emails on schedule → client pays by EFT → admin records payment →
real tax invoice generated and emailed.

### Dates & timezone

The business runs in **SAST (Africa/Johannesburg, UTC+2, no DST)**. Vercel runs in **UTC**.

- A **calendar date** is a *day*: `booking.date`, `originalDate`, `dateOfBirth` are `@db.Date`
  columns stored at UTC midnight. Build them with `calendarDate("2026-07-08")`.
- A **real instant** is a *moment*: `createdAt`, `paidAt`, `new Date()`. Resolve to a day with
  `saDateStr(x)` — never `.toISOString().slice(0, 10)`, which gives the *UTC* day and is wrong
  for two hours every night. **The SAST day turns over at 22:00 UTC.**

`lib/dates.ts` owns `TIMEZONE` and exports `saDateStr`, `saToday`, `saFormat`, `saInstant`,
`saDayStart`, `saDayEnd`, `calendarDate`, `addSaDays`, `diffSaDays`, `saMonthStart`,
`isSameSaDay`, `bookingStartsAt`, `isSaDateStr`.

- **It fails closed.** Malformed input throws rather than returning an `Invalid Date`, which
  compares `false` both ways — so a Prisma `where` built from one silently matches nothing, a
  failure that reads exactly like "no results". At untrusted boundaries guard with
  `isSaDateStr()` first and fall back.
- **Ranges over a timestamp column** use `gte: saDayStart(d), lt: saDayStart(addSaDays(d, 1))`.
  `saDayEnd` is inclusive-to-the-second and misses the last 999ms.
- **Thresholds phrased in days** use `diffSaDays`, not division by 86,400,000 (23:00 Mon →
  08:00 Tue is 1 calendar day but floors to 0).
- **Exceptions that look like bugs but aren't:** `.slice(0, 10)` on a `@db.Date` is exact, and
  two Graph call sites slice a datetime string legitimately because the request sends a
  `Prefer: outlook.timezone` header. Do not "fix" those.

### URLs & the two domains

A URL in an email or PDF must follow the *recipient's* region, never a hardcoded domain.
Three resolvers: `getBaseUrl()` (`lib/get-region.ts`, request context, reads the region cookie
the middleware set) · `getBaseUrlForCurrency(currency)` (emailing **someone else's** record —
cron, webhook, admin action: ZAR → `.co.za`, else `.online`) · `appBaseUrl()` (last resort
with neither host nor recipient; folds `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_BASE_URL`, not yet
region-aware).

The `NEXT_PUBLIC_APP_URL` override in `getBaseUrlForRegion` is **non-production only** — in
prod it would send every international client's links to `.co.za`, because there is one env
scope for both domains. The `dual-domain` check forbids the literal outside `lib/region.ts`,
`lib/copy.ts` and `app/layout.tsx`.

### Multi-currency

Bookings store `priceCurrency` (ZAR/USD/EUR/GBP) and `priceZarCents`. PaymentRequests have
their own `currency`. VAT applies to **ZAR only** — international currencies are zero-rated.
Session rates are configured per currency in SiteSettings.

### Calendar (Microsoft Graph)

A single booking gets one event. A recurring series gets **one recurring event**, and every
booking in it shares that series-master `graphEventId`. Removing one booking's entry goes
through `removeBookingFromCalendar()`, which decides by **counting how many bookings hold the
id** — a master is shared by its siblings, a standalone event is held by exactly one booking.
Do not infer the shape from `recurringSeriesId`: that asks about the booking, and it has been
wrong in both directions (§6).

### Naming

Server actions `verbNounAction` · components PascalCase · files kebab-case · DB fields
camelCase · Tailwind utilities only, no custom CSS · currency always integer cents.

### Gotchas

1. **`priceZarCents` is misnamed.** It stores cents in whatever currency the booking used.
   Always check `priceCurrency` alongside it.
2. **`getSessionRate()` is fallback lookup only.** When billing existing bookings, use the
   booking's stored price, not a re-fetched rate.
3. **PaymentRequest is unique on `[studentId, billingMonth]`.** For two PRs in one month in
   different currencies, append the currency to the `billingMonth` key.
4. **Supabase auth tokens in URLs need `encodeURIComponent()`.** Base64 contains `+` and `/`,
   which break in query strings.
5. **The `(public)` route group layout wraps all public pages**, including `/reset-password`
   and `/login`. It has no auth guards.
6. **`lib/generated/prisma` is git-ignored** and rebuilt by `postinstall` and `build`. A stale
   local client is the usual cause of `prisma.someModel is undefined` after a schema change.

### Brand

Warm, empowering, professional but approachable. *"You are not broken. You are becoming."*
Sage `#87A878` · cream `#F5F0E8` · dark sage `#5C7A52` · terracotta `#C4704F`. Playfair
Display (headings), Lora (body), Cormorant Garamond (accent). Admin UI is shadcn/ui default
theme, not brand-styled.

<!--
  MAINTENANCE (stripped, free)
  Intake on every incident — stop at the first structural yes:
    name the bug CLASS → hook? (+twin +probes) → check? (+probes) → either way,
    reasoning including the false lead to a comment at the site → single-file?
    comment only → cross-cutting guidance? scoped rule file → global or
    unenforceable? §5, visibly → portable? docs/LESSONS.md with an Applied: line
    (a date or n/a: — never "pending").
  Ratchet each release: report N unenforceable + delta. Controls trend up, prose
  trends down; both growing means prose is being reached too early.
-->
