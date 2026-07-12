---
description: Adversarial walk of the current work before pushing — verify against origin, hunt fail-opens
---

Walk the work just completed as an adversarial reviewer. You are trying to REFUTE the done-report,
not confirm it. For an independent pass, spawn the `walker` agent on the diff and fold its findings
in — its fresh context catches what the author's context cannot.

1. **Origin, not working tree.** `git fetch origin` and diff every claim against the pushed state.
   Uncommitted work that a report calls "done" IS a finding.

2. **Verify claims in the artefacts.** Every "done" claim gets checked in the actual files. Live-data
   claims ("58 bookings have a stale link") require an actual query — send them to the `db-inspector`
   agent. Repo-wide pattern claims ("no naive date slices remain") go to the `census` agent, with
   synonym spellings, and a zero only counts if the probe demonstrably fires on a known positive.

3. **Fail-open hunt on the diff.** For every guard, check, or computation touched: if this input is
   malformed, missing, stale, or out of range, does the code fail toward "looks valid"? Precedents
   from this repo: an `Invalid Date` compares `false` both ways, so a Prisma `where` built from one
   silently matches nothing and reads as "no rows"; V8 rolls `2025-02-29` forward to 1 March rather
   than rejecting it; a zone-less datetime string resolves in the *server's* timezone.

4. **Adversarial composition.** Verification tells you what each piece does; only composition tells
   you what they do to each other. The canonical miss here: the invoice CSV rows were fixed to render
   in SAST while the CSV *filter* still built financial-year boundaries at local midnight — so an
   invoice displaying 1 March exported inside FY2026. Do the gate and the computation it guards
   anchor on the same value, the same timezone resolution, the same end of the range?

5. **The standing surfaces.** Dates → `lib/dates.ts` (a `@db.Date` is a day, `paidAt` is a moment,
   the SAST day turns at 22:00 UTC). Money → no hardcoded price or currency, `formatPrice(cents,
   currency)`, `priceZarCents` is misnamed. Actions → `requireRole()` first, `revalidatePath()`
   after, `recordAudit()` on state changes, no side effects in a "save".

6. **Tests exercise the bug, not the fix.** Every closed fail-open needs a fixture that FAILS on the
   old code. A test asserting a bug's current behaviour is worse than no test. `npm run check` must
   be green; if dates were touched, `npm run test:dates` too.

7. **Report findings ranked most-severe first** — file + symbol (never line numbers; they go stale
   same-day), a concrete failure scenario per finding (inputs/state → wrong outcome). If nothing
   survives, say so plainly; do not manufacture findings.

$ARGUMENTS
