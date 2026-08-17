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

### Next up: P1 date edges (the last P1 group)

- [ ] **#12 — "Mark All Completed" completes today's FUTURE sessions.** `date: { lt: new Date() }`
      against a UTC-midnight `@db.Date`: from 00:00 UTC, today's 15:30 session qualifies.
      Use `calendarDate(saToday())` as `bookings/page.tsx:165` already does.
      **Do this before month-end** — wrongly completed sessions feed straight into billing.
- [ ] **#13 — public holidays bookable for singles but not series**, and series creation
      leaves holiday "ghost" occurrences in Outlook that the client will show up to.
      `lib/availability.ts` has no `isSAPublicHoliday` check; `lib/recurring-dates.ts:114`
      does. The rebuild action prunes ghosts, creation does not.

### Follow-ups created by today's work

- [ ] **Partial payments are recorded but not acted on.** `paidAmountCents` now exists on
      `payment_requests`, but reminder/overdue emails still chase the full `totalCents`,
      and the admin UI does not show that money arrived. Small, but touches client-facing
      email copy — worth Stean seeing the wording.
- [ ] **20 admin actions still throw masked messages**, recorded in `KNOWN_DEFECTS` in
      `scripts/architecture-audit.mjs` with a reason each. The list may only shrink; one
      was retired today. `users/actions.ts → changePassword` is worth doing early (a
      masked "password too short" is genuinely confusing).
- [ ] **Desktop repo path** — write it into the machine table in `CLAUDE.md` once chosen.

### Data / decisions waiting on Stean

- [ ] **Orphaned booking** `cmo0y71tg000004lb14zn9exn` — Isabella Pampe, 20 Apr, R895,
      `studentId` NULL so it can never be billed. Exactly one student matches her email
      (`isabellapampe@icloud.com`, inactive, **prepaid**). Relinking is unambiguous but
      would drop a priced session into the unbilled pool — his call.
- [ ] **Three overdue payment requests**: Roxanne Bouwer R1,790 (129 days — billed to
      herself, looks like a test worth voiding), Cyle Davids R895 (40 days), Joe de Wet
      R3,580 (9 days).
- [ ] **Credential exposure.** `lt-src.tgz` (deleted today) was a full source archive
      **containing `.env.local`**, sitting in a synced OneDrive folder since 21 July.
      Deleting it does not undo where it synced. If it reached a device Stean does not
      control, those keys should be rotated: Supabase service role, Paystack secret, MS
      Graph client secret, Resend, `ENCRYPTION_KEY`.

### P2 — 13 items, untouched

From the report; `#18` and `#21` are worth pulling forward:

- **#18 HTML injection into transactional emails** via client-supplied names
  (`lib/email-render.ts:260-266`) — unauthenticated booking form, so phishing markup can
  be delivered from the trusted domain. Escape at `replacePlaceholders`.
- **#21 dormant follow-up skips `consentGiven`** (`lib/cron/dormant-follow-up.ts:40-46`) —
  the only marketing sender that does not check it. POPIA-relevant.
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
