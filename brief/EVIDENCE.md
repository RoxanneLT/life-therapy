# Evidence

> **Every fact available to this project, with its source.** Nothing elsewhere in this tree may
> state a fact this file does not carry. If a claim is not here it is not established — ask; do not
> estimate, round or infer.
>
> Fill this file FIRST. Everything else references it.

Seeded 2026-09-09 from measurements already made and recorded elsewhere in the repository. Every
row below was **measured, not estimated**, and names where the measurement lives. Where a number is
dated, the date is when it was taken — a count is a fact about a moment.

## Email engagement

- **65 of 181 clients (36%) were auto-paused from every campaign, drip and birthday email**, on a
  rule that read a 1×1 tracking pixel. Discovered 2026-08-19 because the practice owner noticed she
  had not received her own system's birthday wish; she had been paused since 2026-03-16. — *source:
  `CLAUDE.md` §6, 2026-08-19 · `scripts/review-auto-paused.ts`*
- **Only 33% of 2,230 tracked sends ever registered an open.** Outlook blocks remote images by
  default, so the signal measured the mail client, not the human. — *source: as above*
- **29 of the 65 are not cold at all** when re-scored against clicks and real account activity. —
  *source: as above*
- **Nineteen emails carrying a Teams link went out over two days with `clicksCount` at 0 for every
  one.** The redirector refused the foreign URL *before* the counter, so the data could not
  distinguish "never clicked" from "clicked and got an error page". — *source: `CLAUDE.md` §6,
  2026-08-19 · narrative at `lib/email-tracking.ts`*

## Data and calendar

- **`calendar_sync_logs` held 1,123 rows** at the point a cancelled session was found still live in
  a client's calendar — and none of them for that cancellation. The tell was the absence. —
  *source: `CLAUDE.md` §6, 2026-08-18 · `lib/calendar-removal.ts`*
- **Zero `booking_deleted` audit rows existed** for an action that writes one *before* it deletes,
  which is how the delete-dialog defect was proven rather than argued. — *source: `CLAUDE.md` §6,
  2026-08-18*
- **Five schema changes reached production ungated** on 2026-08-18, through a path that supplies
  the database URL by `--env-file` reference rather than on the command line. — *source:
  `CLAUDE.md` §6 · `.claude/hooks/ddl-gate.js`*

## Repository and tooling

- **118 git objects became unreadable** when the repository lived inside OneDrive; `git fsck`,
  `git rev-list` and `git push` all failed with `mmap failed: Invalid argument`. Cost: a working
  day. — *source: `CLAUDE.md` §6, 2026-08-17*
- **10 duplicated function bodies across 1,352** — 0.7% — on the first run of the duplication
  check. Low enough to be a control rather than noise, which is why it was worth building. —
  *source: `docs/MECHANISABLE.md` M-04, measured 2026-08-19*
- **47 of 197 client components** import a server action without importing `toast`. The share of
  those right to match is what refused the mechanism. — *source: `docs/MECHANISABLE.md` M-05,
  2026-08-19*
- **The confirmation-dialog count is 12 or 18**, moving purely on whether a `<Dialog>` counts
  alongside `<AlertDialog>` — so it measures the detector, not the codebase. — *source:
  `docs/MECHANISABLE.md` M-06, 2026-08-19*
- **The gate is 62 audit checks, 139 gate probes (17 + 65 + 57) and 231 tests**, all green. —
  *source: `npm run check`, 2026-09-09*
- **Four npm advisories are carried, none reachable from a request this app serves.** All four are
  the Prisma CLI subtree; the only offered fix is a major version downgrade. — *source:
  `docs/DEPENDENCY-ADVISORIES.md`, 2026-09-09*

## Agents

- **8 agent runs recorded**: `grounder` ×5 (median 59 turns), `db-inspector` ×1 (22 turns, a
  2,552-token report against a 2k budget — one overrun), `census` ×2. Every run top-level; no agent
  has spawned an agent. — *source: `npm run agents:distribution`, first reading 2026-08-20*
- **All 8 predate the current budgets**, so they are not evidence about them. The re-measure
  trigger stands at 0 of 20 under the current spines. — *source: as above*

---

## Claims that are interpretation, not fact

Defensible, and **not evidence**. They are argued in `product/`, and must not be quoted as though
they came from a source.

- Nothing yet. When `product/` gets its first argued document, its claim goes here so the boundary
  between what was measured and what was reasoned stays visible. An empty section is the honest
  state of a brief seeded on its first day; deleting it would make the boundary invisible rather
  than absent.
