# Session handover — 2026-08-17

**Context:** started as "why can't the admin update a client", became the P0/P1 sweep of
the 2026-07-21 diagnostics report, plus moving the repo out of OneDrive after it
corrupted `node_modules` and then the git object store.

**State (end of 2026-08-18):** `npm run check` green — tsc + eslint + **33 audit checks
+ 170 tests**. `next build` green. Working tree clean, everything pushed.

The 2026-07-21 report is now fully worked: **all P0, all P1, and all 13 P2 items** are
closed. What is left is listed under §4 and is mostly decisions and one verification,
not code.

Three themes ran through the day and are worth knowing before touching anything:

1. **A word carrying more than one fact.** `failed` meant "this job broke", "this job
   found drift" and "this job noticed ANOTHER job's failure" — so 29 of 31 nights read
   red, and the genuine problem underneath was unreadable. Split into `failed` and
   `observed`. I misread it three times myself before spotting it, which is the point.
2. **Defences applied to half their sites.** Escaping existed but only on the public
   booking path; expiry stamping existed but only on one of four credit-granting paths;
   a durable rate limiter existed but the endpoint that writes client records used the
   in-memory one. The bug was never the missing idea, it was the missing site.
3. **Checks that could not fail.** Two new audit checks shipped green and useless on
   first attempt (one scanned comment-stripped source for a string literal; one matched
   the word `consentGiven` in its own explanatory comment). Both were caught by planting
   a violation. Do not trust a green check you have not seen fail.

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

- [ ] **19 admin actions still throw masked messages**, recorded in `KNOWN_DEFECTS` in
      `scripts/architecture-audit.mjs` with a reason each. The list may only shrink; one
      was retired today. `users/actions.ts → changePassword` is worth doing early (a
      masked "password too short" is genuinely confusing).
- [ ] **Desktop repo path** — write it into the machine table in `CLAUDE.md` once chosen.
- [ ] **The partner invite is not sent.** `couplesPartnerEmail`/`Phone` are now stored and
      shown on the booking page, but nothing emails the partner. The portal form still
      says they will receive the invite — so the promise is now only half kept. Needs an
      email template and a decision about whether the partner gets the Teams link.
- [ ] **Verify the client-profile save fix in a running app.** Every component under
      `clients/[id]` now calls `router.refresh()` after a mutation. Diagnosed from code,
      NOT demonstrated — it is the one change from 18 Aug I would want clicked through.

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
      open payment request. **Time-sensitive:** the overdue chase now repeats weekly, and
      his last notice was 11 Aug, so an unrecorded payment means he is chased again for
      money he has already sent.
- [ ] **Mia Pretorius' series has no calendar events.** 25 bi-weekly sessions,
      20 Aug 2026 → 22 Jul 2027, **next one 20 August**. The bookings all carry a
      `graphEventId`, so this is not a missing id — the event it points at no longer
      exists in Outlook. Fix is the **Rebuild series calendar** button on any booking in
      the series; it creates ONE recurring event and repoints all 25.
      Do NOT "just add 25 events": the codebase holds one-event-per-series, and the
      cancel/reschedule paths call `deleteRecurringEventOccurrences` on the series master.
      Rebuilding sends Mia a fresh invite, so it is her-visible.
- [ ] **One orphaned Outlook event** — Cheslon Faroa, 10 Sep 13:00. That booking was
      cancelled on 13 Aug but the occurrence was never removed from the calendar (the
      cancel path warns when that fails, and the warning was missed). Safe to delete;
      the reconciler marks it `deletable`.

### Calendar drift — probed 2026-08-18

Now that the noise is gone, here is what the reconciler actually reports: 375 bookings
checked, 350 matched, **0 mismatched, 0 duplicates, 0 on-holiday, 0 errors**. The entire
"drift on most days" was the two items above — one broken series and one stale
occurrence. It is a much smaller problem than 144 red runs suggested.

### P2 — all 13 done (2026-08-18)

`#18` and `#21` were pulled forward first:

- [x] **#18 HTML injection into transactional emails.** The report said to escape at
      `replacePlaceholders`; that would have fixed only the DB-template path and left the
      hardcoded fallback — the path used whenever a template is missing or inactive —
      wide open. Escaping happens at `renderEmail` instead, where both paths meet, with
      `RAW_HTML_VARIABLES` as the single registered bypass. Subjects stay unescaped (they
      are plain text). One admin-notification block was also interpolating a client's name
      raw; its twin on the public path had escaped since it was written.
- [x] **#21 dormant follow-up now checks `consentGiven`.** 4 of the 14 clients in the
      dormant pool had not consented and will no longer receive it.
The remaining eleven were done the same day. Each commit carries the reasoning; the
short version, and the parts where the report's description turned out to be wrong:

- [x] **#16** — the reported "void a PAID invoice" is blocked by a hidden button. The real
      hole was **partly-paid** requests: a short payment leaves the status `pending`, so the
      one guard in the path could not see it, and voiding released the sessions to be
      re-billed at full price. Hit live on 18 Aug. Now judged on money received, server-side.
- [x] **#17** — audit added, capturing the price AND currency before they are zeroed.
- [x] **#19** — the booking and the credit that pays for it now commit together. Per date,
      not per series: a whole-series transaction would undo the deliberate "skip a taken
      slot and carry on" behaviour.
- [x] **#20** — zod at every write, lenient read (historical rows must still render). Found
      a live money bug: manual PR entry had no zero floor, so a discount larger than the
      line wrote a NEGATIVE total that the PDF printed verbatim.
- [x] **#22** — MFA had no rate limit and no audit trail. 5/15min on the user id + an IP
      bucket, cleared on success.
- [x] **#23** — reminders were read-then-send-then-stamp with TWO runners (the 2-hourly cron
      and the daily safety net). Atomic claim now; a failed send hands the claim back.
- [x] **#24** — both sites exploitable, and worse than described: the auth callback
      CONCATENATED `${origin}${next}`, so `next=@evil.com` gave host evil.com — no leading
      slash needed, so a `startsWith("/")` fix would not have worked. The click tracker was
      an open redirector (`!allowedHost && protocol !== "https:"` let every https URL
      through). One `safeNextPath` now, with the bypass strings as test fixtures.
- [x] **#25** — the newsletter route's limiter was in-memory (per-lambda, resets on cold
      start) on an endpoint that writes a students row via `upsertContact`. The write being
      one file away is why the audit's own check never saw it.
- [x] **#26** — NOT a size problem: the largest log table is 1.5 MB. The finding was
      `rate_limits` storing **raw IPs in plaintext** as the primary key. All keys hashed
      now, the 20 stale rows deleted, and the daily cron prunes spent counters.
- [x] **#27** — only the PORTAL flow dropped anything, and it dropped it because there was
      nowhere to put it. Two nullable columns added; the form now keeps what it asks for.
- [x] **#28** — the DB index already stopped the double-booking, so this was a UX bug: the
      admin saw a masked error instead of "that slot is taken". Server-side check via
      `getAvailableSlots` (not a third copy of the series conflict query) + P2002 handling.

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
