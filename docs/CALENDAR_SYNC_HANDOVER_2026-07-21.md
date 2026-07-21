# Calendar Sync — Portal vs Teams/Outlook: handover

**Date:** 2026-07-21
**Context:** Reported inconsistency between portal bookings and Teams invites (Chanene
Norman: portal Tue 11:30 → Teams Wed 11:30), plus a "Connection Check" showing
~69 portal bookings "missing" from Teams. Investigation found **four** distinct
issues, one already fixed. This is the handover for the remaining work.

---

## ⚠ ACTIVE INCIDENT — data already lost

**Today's 12:00 manual `autoFix` reconcile run DELETED 50 of Chanene Norman's real
future recurring calendar occurrences** (2026-08-12 → 2027-07-21), every one tagged
`action: "deleted_ghost_event"` in `calendar_sync_logs`. Her booking rows are intact
(49 future Tuesdays, correctly sharing one series-master `graphEventId`), but the
individual occurrence events Graph had materialised on the calendar are gone, and
auto-fix does **not** recreate recurring events — so her forward calendar is now
largely empty and will not self-heal.

This is bug #1's blast radius meeting bug #5 (below): the wrong-day events look like
orphans, and the reconcile happily deletes recurring-series occurrences it will never
recreate. **The daily 06:00 UTC cron runs the same `autoFix` and will keep doing this
to any day-mismatched series in the window.** Gate it off before the next run
(runbook step 0).

## TL;DR

| # | Bug | Severity | Status |
|---|-----|----------|--------|
| 1 | Recurring Teams events created **one weekday late** (date-fns `"e"` vs `"i"`) | High — every recurring series wrong in Teams, and it drives the deletion in #5 | **Fixed in code** (`8dd7e59`, local master, **NOT pushed/deployed**) |
| 5 | Reconcile reverse-pass **deletes recurring-series occurrences it never recreates** (asymmetric: forward pass skips recurring *creates*, reverse pass has no such guard on *deletes*) | **Critical — active data loss** (50 of Chanene's occurrences already deleted) | Diagnosed, not fixed |
| 2 | "Connection Check" compares portal against a **50-event cap** → false "missing 69" | Medium — alarming but **read-only**, not destructive | Diagnosed, not fixed |
| 3 | **In-person** bookings never reconcile; daily auto-fix **converts them to Teams meetings** | High — silent data change + wrong meeting type (0 in-person bookings in prod right now, so not currently biting) | Diagnosed, not fixed |
| 4 | `calendarView` pagination **drops the timezone header** on page 2+ | Latent — only bites at >999 events in the window | Diagnosed, not fixed |

**The two reported symptoms explained:**
- *"Auto-fix found nothing wrong, but Chanene is still wrong"* → bug #1 + the reconcile
  design: a wrong-**day** event is not a "mismatch", it's logged as *missing* (the
  Tuesday booking) + *orphaned* (the Wednesday event). Auto-fix **deliberately skips
  recurring** bookings so it won't recreate/fork a series — but the reverse pass has no
  such guard, so it *deletes* the Wednesday orphan. Net: "nothing fixed", her booking
  still reads missing, and her real events get wiped (bug #5).
- *"Outlook says 69 missing compared to portal"* → the `missing` figure **from today's
  one-off manual `autoFix` run itself** (`checked:304, matched:235, missing:69,
  orphaned:50, fixed:50`), not a number derivable from any `bookings` filter (closest
  is 48 = next-30-days, still 21 off). `missing` jumped 26→69 in the *same run* that
  deleted 50 events and `matched` fell 272→235 — the deletion and the count are the
  same event. The scheduled 4-hourly runs sit at a stable `missing:26, orphaned:0`
  (see "separate pre-existing issue").

---

## Bug #1 — Recurring events land one weekday late  *(FIXED in code, not deployed)*

**Where:** `lib/graph.ts` → `createRecurringCalendarEvent()`, line ~261.

**Root cause:** the Graph `daysOfWeek` was computed with the date-fns token `"e"`:
```ts
const dayIndexSast = parseInt(formatInTimeZone(startDate, TIMEZONE, "e"), 10); // WRONG
```
`"e"` is the **locale** day-of-week — in the en-US default, week starts Sunday, so
Sunday=1, Monday=2, Tuesday=3… The code (and the `dayIndexSast === 7 ? 0` remap right
below it) assumed **ISO** numbering (`"i"`: Monday=1 … Sunday=7). So every recurring
series was created one weekday **late**: a Tuesday booking produced a Wednesday Teams
event. The portal DB was always correct; only the Teams event is wrong. Single
(non-recurring) bookings never compute a weekday and are unaffected.

**Fix (already applied locally):** token `"e"` → `"i"`. Verified all seven weekdays map
to the correct `GRAPH_DAY_NAMES` entry; `npm run check` green (25 checks, 67 tests).
Committed as `8dd7e59` on `master` — **still needs to be pushed and deployed.**

**Post-deploy repair (manual):** every recurring series created *before* this deploys
is still on the wrong weekday in Outlook/Teams. Auto-fix will **not** repair them (it
skips recurring — see bug #5). Repair each affected series with the admin **"reschedule
series"** action, which rebuilds the Graph event (lands correctly post-fix) and sends
fresh invites. Do this **before** re-enabling any reconcile auto-fix over these series.
NOTE: rescheduling *before* the fix is deployed just creates fresh wrong-day events
that the next auto-fix will delete again — deploy #1 first.

---

## Bug #5 — Reconcile deletes recurring occurrences it will never recreate  *(CRITICAL, active)*

**Where:** `lib/calendar-reconcile.ts` — forward pass line ~196, reverse pass line ~213.

**Root cause:** an asymmetry between the two passes:
- Forward pass (create missing): guarded — `if (autoFix && !booking.recurringSeriesId …)`
  — it will **not** auto-create an event for a recurring booking (correct: recreating a
  single occurrence would fork the series).
- Reverse pass (delete ghosts): line 213 has **no such guard** — it deletes **any**
  session event whose `date|time|clientName` key has no matching booking, including the
  materialised occurrences of a recurring series.

So the moment a recurring series' occurrences don't key-match their bookings — which is
*exactly* what bug #1 causes (events on Wednesday, bookings on Tuesday) — the reverse
pass deletes them and the forward pass refuses to put them back. The series' calendar
is silently wiped.

**Evidence (prod, confirmed):** the 2026-07-21 12:00 manual `autoFix` run
(`checked:304, matched:235, missing:69, orphaned:50, fixed:50`) deleted 50 events
between 11:59:47 and 12:00:48, **all Chanene Norman**, all `deleted_ghost_event`, dated
2026-08-12 → 2027-07-21. Last-7-days delete volume: `delete` 105, `delete_occurrence`
41 (the `delete_occurrence` ones are the legitimate single-occurrence cancel path; the
`delete` ghost-deletes are the ones to scrutinise).

**Why scheduled runs looked clean:** the 4-hourly scheduled reconciles show
`orphaned:0` — they were not finding these orphans (different window/timing; Chanene's
wrong-day events appear to have been (re)created between the 10:00 scheduled run and the
12:00 manual run). Do **not** take `orphaned:0` on the scheduled job as "safe" — the
365-day `autoFix` path (daily cron + admin button) is the one that deletes.

**Fix:**
1. **Guard the reverse pass for recurring events** — never delete an event that maps to
   an active recurring series (or, at minimum, never delete when the forward pass would
   refuse to recreate). Report it for manual review instead.
2. Fix bug #1 (done) so recurring occurrences key-match and are never seen as orphans.
3. Consider requiring an explicit confirmation / dry-run diff before any bulk delete.

---

## Bug #2 — "Connection Check" caps Teams events at 50 → the false "69 missing"

**Where:**
- `lib/graph.ts` → `getCalendarDiagnostics()`, line ~670: `calendarView` query with
  `$top: 50` and **no pagination**.
- Consumed by `app/(admin)/admin/(dashboard)/settings/calendar-sync-section.tsx` →
  `WeekComparison` (lines ~444–469). It builds `teamsKeys` from those ≤50 events and
  counts `missingInTeams = portal.filter(p => !teamsKeys.has(key(p)))`.

**Why it produces a scary number:** the comparison holds *all* portal bookings in the
selected range against *at most 50* Teams events. Over any window with more than 50
events, every booking beyond the first 50 chronological events is flagged "not in
Teams" — a pure artifact. On top of that, within the 50 it also fails to match:
- recurring bookings (bug #1 — event is on the wrong day), and
- in-person bookings (bug #3 — subject suffix breaks the name match).

So the "69" is **mostly/entirely a measurement artifact**, not 69 genuinely unsynced
bookings. It is a **read-only display** — it does not drive auto-fix, so it is not
itself destructive. (The reconcile/auto-fix tool is separate and pulls the calendar
correctly with `$top: 999` + pagination.)

**Fix:** paginate `getCalendarDiagnostics` (follow `@odata.nextLink` like
`fetchCalendarEvents` does) — and while there, apply the bug #4 fix (re-send the
`Prefer` header on each page). Alternatively segment the window, but pagination is the
real fix. After #1 and #3 are fixed, this view should read ~0 for a correctly-synced
calendar.

---

## Bug #3 — In-person bookings never reconcile; daily auto-fix converts them to Teams

**Where:**
- Subjects are built with an **" (In Person)" suffix after the client name**:
  `app/(admin)/admin/(dashboard)/bookings/actions.ts:708` and `:901`
  ```ts
  subject: `${config.label} — ${clientName}${data.sessionMode === "in_person" ? " (In Person)" : ""}`
  ```
- The reconcile + comparison parse the client name by splitting on `" — "`:
  `lib/calendar-reconcile.ts:144` and `calendar-sync-section.tsx:460,511`
  ```ts
  clientName: subject.split(" — ").slice(1).join(" — ").trim()  // → "Name (In Person)"
  ```
  So the parsed name is `"Name (In Person)"`, which never equals the booking's
  `clientName` (`"Name"`). The match key (`date|time|name`) therefore never matches.

**Impact — this one is destructive.** The daily cron
(`app/api/cron/daily/route.ts:121`) runs `reconcileCalendar({ autoFix: true,
daysAhead: 365 })`. In one run, for an in-person booking:
1. **Forward pass**: booking `"Name"` finds no event at `date|time|Name` → reported
   *missing* → for a **non-recurring** booking it **creates a new event** via
   `tryCreateMissingEvent`, whose subject is `"${label} — ${clientName}"` (no suffix)
   and which is an **online Teams meeting**, and **re-invites the client**.
3. **Reverse pass**: the original in-person event (`date|time|"Name (In Person)"`) has
   no matching booking → treated as a *ghost* → **deleted**.

Net effect: the real in-person calendar event is deleted and replaced by a Teams
online meeting, and the client is re-invited to the online meeting — a silent
conversion of an in-person session into an online one. Because the recreated subject
has no suffix, it then matches on subsequent runs (so it's a **one-time** conversion
per booking, not perpetual churn — but the damage is already done). Recurring in-person
bookings are skipped by auto-create, so they instead sit permanently as "missing" and
their real event is deleted as a ghost with **no replacement**.

**Fix:**
1. Strip the `" (In Person)"` suffix when parsing the client name, in **both**
   `lib/calendar-reconcile.ts` and `calendar-sync-section.tsx` (helper, e.g.
   `parseClientName(subject)` → split on `" — "`, then `.replace(/ \(In Person\)$/, "")`).
2. When `tryCreateMissingEvent` recreates an event, carry the booking's `sessionMode`
   and pass `isOnlineMeeting: false` for in-person, so a repaired in-person booking is
   not silently turned into a Teams meeting. (Requires selecting `sessionMode` in the
   reconcile booking query and threading it through.)
3. **Until #3 is fixed, treat the daily auto-fix as unsafe** — see runbook.

**Verify in prod (query running):** whether the delete log
(`calendar_sync_logs where operation='delete'`) shows in-person events being removed
by recent daily runs. Result to be appended below.

---

## Bug #4 — `calendarView` pagination drops the timezone header  *(latent)*

**Where:** `lib/calendar-reconcile.ts` → `fetchCalendarEvents()`, lines ~284–303.

The first page sends `Prefer: outlook.timezone="Africa/Johannesburg"`, so Graph returns
SAST-local datetime strings (the code slices `substring(11,16)` for the time assuming
SAST). But the pagination loop:
```ts
page = await client.api(page["@odata.nextLink"]).get();  // no Prefer header
```
does **not** re-send the header, so page 2+ come back in **UTC** — every time on those
pages is off by 2 hours, producing mass false *missing* + *ghost* pairs, and (under
auto-fix) the ghost-deletion could then delete **correct** events (bounded only by the
60-writes/run budget).

**When it bites:** only when the window holds **more than 999 events** (single page is
`$top: 999`), so it's currently **latent** — but it's a live landmine as volume grows,
and it makes bug #3's deletion risk worse once triggered.

**Fix:** re-apply `.header("Prefer", \`outlook.timezone="${TIMEZONE}"\`)` on each
`@odata.nextLink` request (and, per bug #2, add pagination to
`getCalendarDiagnostics` with the same header on every page).

---

## Production diagnostics  *(confirmed, read-only — 2026-07-21)*

Run against prod via the Supabase Management API. Columns are quoted camelCase
(`"startTime"`, `"recurringSeriesId"`, `"graphEventId"`, `"clientName"`, `"sessionMode"`).

**Chanene Norman — 51 rows, architecturally correct in the DB:**
- 2 non-recurring `free_consultation` (2026-07-15, 2026-07-21, both completed), each its
  own `graphEventId`.
- 49 recurring `individual` sessions, **every Tuesday 11:30–12:30**,
  `recurringSeriesId = c7affff6-15ed-4bbf-a6c5-61ff2b5faac0`, 2026-08-11 → 2027-07-27,
  **all 49 sharing one series-master `graphEventId`** (per the documented architecture).
  The DB is right; the calendar is what got damaged (bug #5).

**The "69" is not a bookings number** — it's the `missing` from today's manual run.
Bookings breakdown (status in confirmed/pending, date ≥ today):
- total future **356** · recurring **346** · non-recurring 10
- **no graph event: 0** · **in-person (`sessionMode='in_person'`): 0** — so bug #3 isn't
  biting *right now*, but the code path is live for the next in-person booking
- next-30-days 48 · distinct future series **22** · distinct `graphEventId` across future 191

**Repair scope — 6 series, NOT 22 (confirmed).** There are 22 future recurring series,
but the `"e"` bug only landed **2026-06-24** (commit `3a8e5bb`), so only series created
or rescheduled *after* that date can be wrong-day. Cross-checking each series'
create/reschedule timestamp against 2026-06-24 leaves **6 at risk**:

| Client | Created | Last reschedule | State |
|---|---|---|---|
| Chanene Norman | 2026-07-21 | — | **events already deleted** (50, today 12:00) |
| Genevieve Chang | 2026-07-21 | — | wrong-day events live on calendar |
| Mia Pretorius | 2026-07-09 | — | wrong-day events live |
| Lisa Toms | 2026-06-25 | — | wrong-day events live |
| Huibri Smith | 2026-04-10 | 2026-07-10 | wrong-day events live |
| Camryn Gohre | 2026-03-16 | 2026-07-21 | wrong-day events live |

The other 16 series were created before the bug and never rescheduled — their Graph
events are correct (consistent with the scheduled runs' stable `orphaned:0`). **Do not
mass-repair all 22** — only these 6 need rebuilding after fix #1 deploys.

**Deletion mechanism confirmed:** all 50 events deleted in the 12:00 run were on a
**Wednesday** (Chanene's bookings are Tuesdays) — zero exceptions. Her series was
*freshly created today at 11:26 UTC* (not a reschedule) and deleted 34 minutes later,
so she likely received ~50 invites then ~50 cancellations today (the "invite noise").

### ⚠ Damage is FAR broader than 6 — ghost deletions have run since day one (2026-06-24)

The "6 at-risk series" (above) is the wrong-day *creation* scope. But the auto-fix has
been **deleting** events since the bug landed. The very first `deleted_ghost_event` is
`2026-06-24 17:07:42 UTC` — minutes after the `3a8e5bb` "harden calendar sync" deploy —
and it kicked off a mass purge. Ghost deletions by client since 2026-06-24:

| Client | Deleted | First → Last | Next session | State |
|---|---|---|---|---|
| **Lisa Toms** | **54** | 2026-06-24 → 06-25 | **2026-07-22 (tomorrow)** | calendar empty ~4 weeks, session imminent |
| Frikkie Erasmus | 1 | 2026-06-24 | 2026-07-23 | mostly intact (1 delete) |
| **Mia Pretorius** | **26** | 2026-07-09 | 2026-07-23 | calendar empty ~12 days (= the `missing:26`) |
| Joe de Wet | 1 | 2026-06-24 | 2026-07-27 | mostly intact |
| Tasmin Mackier | 6 | 2026-06-24 | 2026-07-29 | partial |
| Martin Smith | 1 | 2026-06-24 | 2026-07-30 | mostly intact |
| **Huibri Smith** | **9** | 2026-06-24 | 2026-07-31 | calendar empty ~4 weeks |
| Aiden Kilian | 2 | 2026-06-24 | 2026-08-03 | partial |
| Winifred Michaels | 11 | 2026-07-06 | 2026-08-03 | calendar empty ~2 weeks |
| Angela Gohre | 18 | 2026-06-24 | 2026-08-04 | calendar empty ~4 weeks |
| Chanene Norman | 50 (+2) | 2026-07-21 | 2026-08-11 | deleted today (freshest) |
| Andrea Behnsen / Micaella White | 1 each | 2026-06-24/26 | — | single stale, likely legit |

**~13 clients affected, not 6.** The single-event deletions (Frikkie, Joe, Martin,
Micaella, Andrea) are probably legitimate stale-event cleanup; the **large counts
(Lisa 54, Mia 26, Angela 18, Winifred 11, Huibri 9)** are wrong-day recurring series
that were mass-deleted with no recreation. Note the 2026-06-24 wave hit series that
predate the bug too, so `3a8e5bb` likely caused a one-time false-ghost purge on top of
the ongoing day-of-week issue — the exact *current* missing set needs a **check-only
reconcile** to confirm (the delete log is history, not present state).

**URGENT:** Lisa Toms has a session **tomorrow (2026-07-22)** with no calendar event on
Roxanne's side (deleted ~4 weeks ago, never recreated). She must be handled *today* —
manual calendar entry now, and "reschedule series" once the fix deploys. Frikkie and
Mia are 2026-07-23. Prioritise repairs by soonest session, not by delete count.

### Genevieve Chang & Camryn Gohre — wrong-day events still LIVE (gated safe)
Created/rescheduled today through the still-buggy code, but **no ghost deletions logged**
for them — their wrong-day events are sitting on the calendar right now. Auto-fix is
gated off, so they won't be deleted; they still need "reschedule series" post-deploy.

**Reconcile logs:**
- Scheduled 4-hourly runs (02/06/10/14/18/22:00), 2026-07-19 → 21: stable
  `checked≈298–300, matched≈271–274, missing:26, orphaned:0`.
- **2026-07-21 12:00:48 — manual `autoFix:true`: `checked:304, matched:235, missing:69,
  orphaned:50, fixed:50`.** This is the run that deleted Chanene's 50 events.
- `cron_runs`: the 4-hourly `reconcile_calendar` job has been `status:"failed", failed:26`
  for 24h+ (the same stable 26 `missing` — see separate issue below).

**Deletes (last 7 days):** `delete` 105, `delete_occurrence` 41. The 50 from the 12:00
run were all Chanene, all `deleted_ghost_event`. `delete_occurrence` is the legitimate
admin single-cancel path; the remaining ~55 `delete` ghost-deletes warrant a closer look.

### Separate, pre-existing issue — scheduled reconcile "failing" with missing:26
The 4-hourly `reconcile_calendar` cron has reported `status:"failed", failed:26` for a
day+, driven by a stable `missing:26`. Predates today's incident, distinct from the
deletion bug — 26 bookings whose events it can't match (candidates: wrong-day recurring
occurrences in-window, and/or genuinely un-synced). Triage separately once deletion is safe.

Queries used are SELECT-only (Supabase Management API, project `ocqucplcdotvewddfmmw`);
full list preserved in the investigation transcript.

---

## Recommended sequence (runbook)

0. **NOW — stop the deletion.** Gate the reconcile **auto-fix** off before the next
   daily 06:00 UTC run. Set the `calendarReconcile` task in `app/api/cron/daily/route.ts`
   to `autoFix: false` (and check the 4-hourly `reconcile_calendar` cron isn't also
   auto-fixing). The read-only report can keep running. Until this is done, every run
   risks deleting more wrong-day recurring occurrences (bug #5).
1. **Deploy bug #1** (`8dd7e59` — push `master`, deploy). New/rescheduled recurring
   series then land on the correct weekday. **Do NOT reschedule any series before this
   deploys** — a pre-fix reschedule just makes fresh wrong-day events for the next
   auto-fix to delete.
2. **Repair the 6 at-risk series** (see prod section — NOT all 22). Chanene first (her
   50 occurrences were deleted today); then Genevieve Chang, Mia Pretorius, Lisa Toms,
   Huibri Smith, Camryn Gohre. After #1 is live, admin "reschedule series" rebuilds each
   Graph event on the correct weekday and re-invites. Roxanne should send Chanene a short
   personal note about the invite/cancellation noise.
3. **Fix bug #5** — guard the reverse pass so it never deletes an event mapping to an
   active recurring series (report for manual review instead). This is the real
   safety fix; #1 removes the trigger, #5 removes the loaded gun.
4. **Fix bug #3** (suffix-safe name parse in `calendar-reconcile.ts` + `WeekComparison`;
   carry `isOnlineMeeting:false`/`sessionMode` through `tryCreateMissingEvent`). No
   in-person bookings exist right now, so this is pre-emptive but cheap.
5. **Fix bug #2** (paginate `getCalendarDiagnostics`) so the Connection Check reports a
   truthful number instead of the 50-cap artifact.
6. **Fix bug #4** (re-send `Prefer` header on paginated `calendarView` pages).
7. **Re-enable auto-fix** only after 1–6 are done and a dry run (`autoFix:false`) over
   365 days reports `orphaned:0` and only genuinely-missing items.

---

## Files touched / to touch

- `lib/graph.ts` — #1 (done), #2 (`getCalendarDiagnostics` pagination), #4-adjacent.
- `lib/calendar-reconcile.ts` — #3 (name parse + in-person recreation), #4 (`Prefer`
  header on `nextLink`).
- `app/(admin)/admin/(dashboard)/settings/calendar-sync-section.tsx` — #3 (name parse
  in `WeekComparison`, lines 460 & 511).
- `app/(admin)/admin/(dashboard)/bookings/actions.ts` — subject construction (708, 901)
  is the origin of the in-person suffix; leave the suffix (it's useful in Outlook) and
  fix the *parsers* instead.
- `app/api/cron/daily/route.ts:121` — the auto-fix entry point to gate in step 1.
