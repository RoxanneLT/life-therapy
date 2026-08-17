# Session handover — 2026-08-17

**Context:** started as "why can't the admin update a client", became the P0/P1 sweep of
the 2026-07-21 diagnostics report, plus moving the repo out of OneDrive after it
corrupted `node_modules` and then the git object store.

**State:** `origin/master` = `aee515f`. 15 commits ahead of where the day started
(`e3f5aa1`). `npm run check` green (tsc + eslint + 26 audit checks + 139 tests).
`next build` green. Working tree clean, nothing unpushed.

---

## 0. Read this first if you are a new session

**The repo is no longer in OneDrive.** See the "START HERE" section at the top of
`CLAUDE.md`. On this laptop it is `C:\dev\life-therapy`; the desktop's path is
deliberately **not yet decided** (it has C/D/E/F, one of which is OneDrive — Stean did
not want it guessed).

First moves, every session:

```bash
git status && git pull      # another machine may have pushed
npm run secrets             # are .env.local etc. still in sync with OneDrive?
```

Two environment facts that cost time today:

- **`prisma db pull`, `prisma migrate` and `prisma db push` all hang or fail** against
  this project's pgbouncer pooler. Verify live schema through the **Supabase Management
  API** (`SUPABASE_ACCESS_TOKEN` in `.env.local`). Approved DDL must be **mirrored into
  `schema.prisma` by hand**, with a comment saying the DB is the source of truth. This
  inverts the usual advice in `.claude/rules/schema-changes.md`, which assumes `db pull`
  works.
- The Supabase **MCP tools do not work** here either (permission error, even for reads).

---

## 1. Production changes made today (not just code)

These are already live. They are listed separately because a code rollback does **not**
undo them.

| Change | Object | Applied |
|---|---|---|
| Partial unique index | `bookings_active_slot_unique` on `bookings (date, "startTime") WHERE status IN ('confirmed','pending')` | via Management API |
| FK `CASCADE` → `RESTRICT` | `enrollments.courseId`, `certificates.courseId`, `module_access.courseId`, `module_access.moduleId` | via Management API |
| New column | `payment_requests."paidAmountCents" integer NULL` | via Management API |

Notes:

- The booking index is **partial** and Prisma cannot express that. It exists only in the
  database and is documented in a comment on the `Booking` model. **Do not "fix" this by
  adding a plain `@@unique([date, startTime])`** — that would forbid a cancelled booking
  and its replacement from sharing a slot.
- The RESTRICT flip was proven by attempting a `DELETE` inside `BEGIN … ROLLBACK` and
  watching it refuse with `23503`.
- Data deleted today: the `_to_delete/` scratch folder in the retired OneDrive copy
  (38 MB). Verified redundant first — its three `*-v3.ts` files were byte-identical to
  what shipped, its patches were exports of commits in history.

---

## 2. Behaviour changes Roxanne may notice

- **Admins can no longer double-book a slot.** Previously possible, silently. If she
  ever overbooks deliberately (two clients in one slot, a placeholder), she will now be
  refused and we need an override.
- **A campaign in `failed` state can now be re-sent** — it resumes rather than refusing.
  Safe because of the new per-recipient dedupe, but it is a visible change.
- **Four clients cannot be saved from the Personal tab** until their phone is fixed:
  Joanne, Elizabeth, James, Jacoline (all inactive/archived, phone stored as `"NA"`).
  That failure always existed; it was invisible before and is now shown clearly.
- **Deleting a course or module is refused** when real enrolments/certificates/module
  purchases exist. "Confidence from Within" is unpublished but has both — exactly the
  course someone deletes thinking it is a draft.

---

## 3. What was fixed, by theme

### The original bug — masked server-action failures
`bd18f6d`, `60e2900`

Next.js strips a thrown server-action message in production and replaces it with
"An error occurred in the Server Components render… a digest property is included".
Every reason a save could be refused — duplicate email, bad phone, missing name —
reached Roxanne as that one unreadable sentence. Catching it does not help: `err.message`
**is** the boilerplate.

Converted to returned `{ success, error }` on the client create/update/relationship
actions, the public booking form, and the portal book/cancel/reschedule/notes actions.
Added the app's first error boundaries (`(admin)`, `(public)`, `(portal)`) — there were
none anywhere. `ENCRYPTION_KEY` moved `OPTIONAL` → `REQUIRED_IN_PROD` (it was
mis-classified in a way that hid itself: `encrypt()` throws without it, but `decrypt()`
catches and returns raw ciphertext, so losing it breaks every write while silently
rendering PII as `iv:tag:ciphertext`).

New audit check `server-action-ux` (26 total). **It first shipped green and unfailable**
because it scanned `code()`, which blanks string literals — the message is the only thing
it looks at. Rewritten and then *proven* by planting a violation.

### P0 — money and data loss
`999410e`, `c7596b9`

1. **Paystack fulfilment** could double-grant on webhook redelivery, or take the money
   and grant nothing (marked paid *before* granting, with a read-then-act guard). Now an
   atomic `updateMany` claim inside one transaction. Gift emails moved outside it.
2. **Portal cancel/reschedule of one session destroyed the whole Outlook series** —
   `graphEventId` is the series master. The admin paths always branched; the portal never
   did, so the worst version was the one clients could reach.
4. **Normal portal cancel minted credits** — refunded on `!isFree && !isPostpaid` rather
   than checking the ledger. Book without spending a credit, cancel with notice, balance
   goes up. Repeatable.
3/5. Slot uniqueness index and the cascade guard (see §1).

Two bugs found while doing the above, in neither report:

- A refused booking left a **confirmed row and a live Graph event** behind, because the
  credit check ran after both were created and threw.
- A **postpaid client ticking "use session credit" got a free session** — price was
  zeroed from the raw checkbox while the deduction skipped postpaid.

### P1 sends & sweeps
`4d57c4b`, `d79a783`, `98178bd`

- **#9** drip/campaign/birthday idempotency counted **failures** as sends (`sendEmail`
  logs failures too). One outage advanced the step permanently. Now requires
  `status: "sent"`.
- **#10** billing-day emails were one-shot; a cron death left PaymentRequests created but
  never emailed. Added a `sentAt: null` sweep, reported as its own `sweptUnsent` field.
- **#14** gifts reported success regardless of delivery — **three** independent causes,
  any one of which hid a paid-for gift that never arrived (discarded result; status
  "delivered" written at creation; retry query used `deliveryDate: { lte: now }` and NULL
  is not `<=` anything).
- **#11** a killed cron reported as a *clean night* — the digest is sent by the run that
  died, so truncation looked like silence. The next run now reports stragglers.
- **#8** broadcast campaigns could not be resumed (stuck in `sending`, guard admitted only
  `draft`, and `templateKey` was a shared literal). Now a per-campaign ledger key with one
  bulk pre-query.

### P1 money edges
`3e56680`, `aee515f`

- **#6** a coupon **replaced** the module-upgrade credit instead of adding to it. R850
  course + R500 owned modules + R50 coupon charged R800 instead of R300 — the coupon made
  the bill R450 *worse* than not using one.
- **#7** the series-reschedule conflict check filtered `recurringSeriesId: { not: seriesId }`,
  which in SQL excludes NULL — i.e. every standalone booking, most of the diary. Rewritten
  as an explicit `OR`.
- **#15** the webhook settled amended invoices short. Now compares against the current
  total, refuses to mark paid, and records the money (see §1 for the new column).

---

## 4. TODO — in the order I would do it

### Done 2026-08-18 (the last P1 group, and the partial-payment follow-up)

- [x] **#12 — day columns compared to a live instant.** Fixed, plus five sibling sites the
      new audit check found that the original grep did not. See the commit for the full
      classification; the client-visible ones were the portal's "upcoming sessions" count
      and the dashboard's Next Session card, both of which dropped today's sessions from
      02:00 SAST. New check: `date-safety: a day column is never bounded by a live instant`.
- [x] **#13 — public holidays.** Singles were bookable on them (availability never checked);
      series generation did check, using a SECOND holiday list that knew nothing about the
      s2A proclamations. One list now (`lib/sa-holidays.ts`), `lib/sa-public-holidays.ts`
      deleted, and a `date-safety: one public-holiday list` check to keep it that way.
      Ghost occurrences at series creation now prune against what was actually created, the
      way the rebuild action already did. **0 of 375 future bookings sat on a holiday**, so
      nothing needed cleaning up by hand.
- [x] **Partial payments are acted on.** Emails, WhatsApp, the pro-forma PDF and the admin
      UI all quote the balance. The received amount rides inside `sessionSummary` rather
      than a new `{{variable}}`, so DB-edited templates show it too — a new placeholder
      would have rendered only in the hardcoded fallback.
- [x] **Client profile saves show what was saved** (reported live, not from the report). No
      component under `clients/[id]` called `router.refresh()`, so every save looked
      discarded until you left and came back. **Diagnosed from code, not demonstrated
      against a running app** — worth confirming in the UI.

### Still open

- [ ] **20 admin actions still throw masked messages**, recorded in `KNOWN_DEFECTS` in
      `scripts/architecture-audit.mjs` with a reason each. The list may only shrink; one
      was retired today. `users/actions.ts → changePassword` is worth doing early (a
      masked "password too short" is genuinely confusing).
- [ ] **Desktop repo path** — write it into the machine table in `CLAUDE.md` once chosen.

### Decided 2026-08-18 — no longer open

- **Isabella Pampe's orphaned booking**: she had paid for sessions cancelled at short
  notice, so it became **1 session credit** on her profile (ledger `admin_grant`), and the
  booking was relinked to her (price and status untouched).
- **Overdue payment requests**: Roxanne's self-billed R1,790 test **voided**. Cyle had
  already paid (his request was already settled). Joe paid on 18 Aug — his request is the
  one still open, waiting for the money to reflect so it can be recorded.
  - Voiding released 4 of Roxanne's March sessions back into the unbilled pool, which
    would have re-billed her the same R1,790 next run (this is P2 #16 in the wild). Those
    4 are now **cancelled** — record only, no client email, calendar left alone, because
    the sessions are months past.
- **Credential rotation**: Stean's call — **not rotating**. The exposure is understood
  and accepted; the archive is deleted.
- **Desktop repo path**: still deliberately blank. `SETUP-NEW-PC.ps1` asks at setup time.
- **Credit expiry**: activated, 180 days. See below.

### Credit expiry — activated 2026-08-18

Most of this existed and had never run: `creditExpiryDays` was never set, so `addCredits`
stamped no `expiresAt`, so the WhatsApp 14/3-day warnings had nothing to find. Nothing
forfeited a lapsed credit either.

- `creditExpiryDays = 180`. **Not retroactive** — `expiresAt` is stamped at grant time, so
  only credits granted from now carry a date. Isabella's was backfilled by hand
  (expires 2027-02-13); she was the only holder.
- New DDL, live: `CreditTransactionType` gained an **`expired`** value (Management API,
  mirrored into `schema.prisma` by hand). A lapsed credit is no longer recorded as `used`,
  which would have counted it as a session attended in every report grouping by type.
- `lib/cron/credit-expiry.ts` warns by **email** at 14 and 3 days and forfeits on the day,
  wired into the daily cron. Email was added because the existing warnings are WhatsApp-only
  and need `smsOptIn` plus a phone — Isabella has neither, so she would have lost a credit
  she paid for with no notice at all.
- Dedupe is keyed by the **expiry date**, not the month, so a later grant starts a genuinely
  new warning cycle; and it matches `status: "sent"`, so one outage cannot suppress a
  warning permanently.
- **The window nearly applied to nothing.** Four paths hand out credits — package purchase,
  gift redemption, admin grant, refund — and only `addCredits` stamped a date. Credits a
  client BOUGHT could never lapse, while the same credits granted by hand did. All four now
  ask `creditExpiry()` in `lib/credits.ts`; a refund is the deliberate exception and does not
  renew the window (cancel-and-rebook would otherwise extend it for ever). Held honest by the
  `credits: a balance that gains credits gets an expiry` audit check.

### Noted for later — pause the chase when payment is on its way

Stean's, 18 Aug, and it comes straight out of a live near-miss: Joe paid on the
17th, the payment could not be recorded until it reflected, and the weekly overdue
re-chase would have emailed him again in the meantime. The system can only act on
money it has been told about, so the gap is a way to say **"money is coming, hold
off"** without either lying that it arrived or voiding the request.

What it needs, roughly:

- A pause marker on `payment_requests` — a nullable `chasePausedUntil DateTime?` is
  the smallest thing that works, and it reads honestly: this is a hold, not a
  payment. (Schema change: needs sign-off, additive, nullable.)
- Every chase in `lib/cron/monthly-billing.ts` skips a request whose pause has not
  expired. One condition, four call sites.
- A default worth choosing deliberately — 7 days is enough for an EFT to clear
  without a forgotten pause becoming a permanently unchased invoice, which is the
  failure mode to avoid.
- Admin UI: a "payment expected" action beside Record Payment on the Finance list,
  and the paused state visible on the row — a silent hold is how an invoice gets
  forgotten.
- Show it in the cron digest, so a paused request is still something a human sees.

Related, and probably the same piece of work: recording a partial payment already
tells us money is moving, so a part-paid request arguably deserves the same hold.

### Waiting on Stean

- [ ] **Joe de Wet's R3,580** — paid 18 Aug, record the payment once it reflects. The only
      open payment request.

### P2 — 11 items left

`#18` and `#21` were pulled forward and are done (2026-08-18):

- [x] **#18 HTML injection into transactional emails.** The report said to escape at
      `replacePlaceholders`; that would have fixed only the DB-template path and left the
      hardcoded fallback — the path used whenever a template is missing or inactive —
      wide open. Escaping happens at `renderEmail` instead, where both paths meet, with
      `RAW_HTML_VARIABLES` as the single registered bypass. Subjects stay unescaped (they
      are plain text). One admin-notification block was also interpolating a client's name
      raw; its twin on the public path had escaped since it was written.
- [x] **#21 dormant follow-up now checks `consentGiven`.** 4 of the 14 clients in the
      dormant pool had not consented and will no longer receive it.
- Others: 16 void-paid-invoice re-queues bookings · 17 `excludeFromBillingAction` has no
  audit · 19 recurring series creation is a long non-atomic loop · 20 invoice `lineItems`
  is unvalidated Json at 13+ sites · 22 MFA TOTP has no app-level rate limit · 23 reminder
  double-send race · 24 open redirects (auth callback `next`, click tracker) · 25 in-memory
  rate limiter still on newsletter + availability · 26 unbounded log tables · 27 couples
  partner fields silently dropped · 28 admin `rescheduleBooking` does no server-side
  conflict validation.

---

## 5. Claims I have NOT verified

Stated plainly so the next session does not inherit them as fact:

- **#7 was fixed by reasoning, not demonstration.** I argued from SQL NULL semantics and
  made the code explicit; I did not prove Prisma's current translation excludes NULLs. The
  fix is correct either way.
- **The original "duplicate email" diagnosis was never confirmed against a real error.**
  The Vercel project is not on the connected account, so no runtime logs were available.
  The fix makes the real message visible; if what Roxanne now sees is something else, that
  is new information, not a contradiction.
- The 2026-07-21 report's own caveat applies to anything still open in §4: its author lost
  their staged repo before finishing line-by-line re-verification. **Confirm the cited
  file and line before changing it** — several line numbers have already moved.

---

## 6. Working agreements observed today

- Verify a claim against current code before acting on it; several report line numbers
  were already stale.
- Classify per site, never sweep. Two `location.assign` call sites in the MFA gate look
  identical to a lint rule's target and are correct for a reason the rule cannot see.
- Prove a new audit check can fail before trusting it green.
- Never push without being asked. Everything above was pushed on explicit instruction.
