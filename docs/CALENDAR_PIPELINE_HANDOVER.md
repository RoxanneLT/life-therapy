# Calendar repair pipeline — handover for review

**Branch:** `master`, 2 commits ahead of origin (`d7edbb1`, `d11be06`) — **not pushed**
**Gate:** `npm run check` green — 25 audit checks, **139 tests**
**Replaces:** the "Check & Auto-Fix" button, per the propose → review → apply brief

---

## The one-line summary

Auto-fix is **gone, not disabled**. There is no `autoFix` flag anywhere in the codebase,
and `reconcileCalendar` imports no write function at all. Repairs now require a named,
approved item that is **re-verified against freshly-read state** at the moment it runs.

Verify both claims cheaply:
```bash
grep -rn 'autoFix\|AUTOFIX_DISABLED' app/ lib/ --include=*.ts --include=*.tsx   # expect: nothing
grep -n 'cancelCalendarEvent\|createCalendarEvent' lib/calendar-reconcile.ts     # expect: nothing
```

---

## Architecture — where each responsibility now lives

| File | Role | Writes? |
|---|---|---|
| `lib/calendar-classify.ts` | **Pure.** Matching, the wrong-day guard, duplicate detection, proposals, and `isStillProposed` (re-verification). No Prisma, no Graph, no network. | never |
| `lib/calendar-reconcile.ts` | Fetches bookings + calendar, parses, calls `classify()`. Returns the classification plus context. | **never** |
| `lib/calendar-apply.ts` | The **only** place repairs execute. Named items, re-verified, skip-and-report, write budget, audit per item. | yes, approved only |
| `settings/calendar-sync-actions.ts` | `super_admin` server action wrapping apply. | via apply |
| `settings/calendar-sync-section.tsx` | Grouped findings, per-item checkboxes, Apply naming exactly what it will do. | via action |

The UI never decides what is safe. It renders the `proposal` the server produced, and
apply re-derives it independently — so a tampered request cannot widen what happens.

---

## The three safety properties, and where to check them

**1. Nothing acts unattended.** Both crons are report-only permanently
(`app/api/cron/{daily,reconcile-calendar}/route.ts`). `reconcileCalendar` has no code
path that writes.

**2. Approval is specific and re-verified.** `applyCalendarRepairs` re-runs the whole
reconcile and checks every item through `isStillProposed` before touching anything
(`lib/calendar-apply.ts`). If the calendar can't be re-read, **nothing is attempted** —
acting blind is the failure this exists to prevent.

**3. The wrong-day guard is enforced twice.** A protected ghost never carries proposal
`delete`, so `isStillProposed` refuses it at execution — including a hand-crafted request
that never went near the UI. Pinned by `lib/calendar-apply.test.ts`.

---

## Two judgement calls worth your scrutiny

### a) Which of N duplicates to delete — my first proposal was wrong

I originally said "keep the event matching `booking.graphEventId`". That is **broken for
every recurring series**: `calendarView` returns expanded *occurrences* with their own
ids, while bookings store the series *master* id — nothing would match, and the tool
could have proposed deleting the client's real event.

Fixed by also requesting `seriesMasterId` from Graph and matching on either
(`eventBelongsToBooking`). Where ownership still can't be proven, the proposal is `none`
and a human picks, because the wrong guess severs the invite the client is holding.

**Please sanity-check the Graph assumption**: that `seriesMasterId` is populated on
expanded occurrences from `calendarView`. It is documented, but it is the load-bearing
assumption behind duplicate ownership and I have not observed it on live data yet — the
first real check after deploy will show it.

### b) Duplicate detection was lifted forward (you left this open)

Mia's case settled it: her manual entry sat beside her rebuilt occurrence and the
reconcile reported a clean `0/0`, because same-slot duplicates were **invisible**. That
made the post-repair verification meaningless for exactly the situation the repair
created. It's in.

---

## What to review, in priority order

1. **`lib/calendar-apply.ts`** — the only writer. Particularly: the re-read-before-act
   flow, the empty-on-error behaviour, and that `applyCreate` refuses recurring bookings
   even though `classify` already won't propose them (belt and braces).
2. **`isStillProposed`** in `calendar-classify.ts` — the whole stale-approval defence is
   these ~12 lines.
3. **`surplusInSlot` / `eventBelongsToBooking`** — the ownership logic from (a).
4. **The UI's read-only groups** — anything not safe to automate must render with no
   checkbox. Wrong-day, ambiguous duplicates, recurring gaps and mismatches all do.
5. **The drift alert copy** in the 4-hourly cron — it leads with a client name and a
   date deliberately.

---

## Probes (all proven to fire, then restored)

| Planted defect | Result |
|---|---|
| `"i"` → `"e"` weekday token | 21 of 41 calendar tests fail |
| Guard returns "always deletable" | exactly the 2 protection fixtures fail |
| Duplicate detection disabled | exactly the 3 duplicate fixtures fail |
| TZ pin flipped to `Pacific/Auckland` | exactly 11 tests fail (matches your Linux run) |

`lib/calendar-apply.test.ts` replays the stale approval three ways, including the nasty
one: an event that was a *safe duplicate* when approved, whose client has since become
eventless — turning it into a wrong-day twin. Refused at execution.

---

## Known gaps — deliberate, not oversights

- **`relativeMonthly` expansion is not simulated** in the lifecycle fake; it throws
  loudly. The monthly index mapping is asserted directly in `graph-payloads.test.ts`
  instead of hiding behind an unverified expander.
- **Monthly series are not pruned** on rebuild; the action says so and a Check surfaces
  any stray.
- **The naive wall-clock parse** in `buildRecurrence` remains — documented, TZ-pinned in
  tests, and deserving its own change rather than a drive-by.
- **`FakeGraph` cannot prove Graph agrees with our model.** That last mile is the live
  smoke check plus the 4-hourly report.
- **Duration mismatches propose nothing** — reported only, per the brief.

---

## Suggested first live check after deploy

Run one Check. Expect `0/0` (the three repairs are done and verified). Then confirm from
`calendar_sync_logs` that the new run carries `duplicates` and `missingByClient` keys —
that proves the deployed code is the new pipeline, and it's the same trick we used to
tell a post-deploy run from a pre-deploy one during the incident.
