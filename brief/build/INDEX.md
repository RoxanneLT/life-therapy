# Build index

> What is built, in what order. Hand-maintained. **≤ 40 KB** — it is read at session start.
>
> What is *blocked on a person* belongs in `GATES.md`, not here.

| Band | State | Note |
|---|---|---|

No bands yet. This brief was seeded on 2026-09-09; the first band written here should say what it
supersedes below.

## Before this brief existed

Four handover documents in `docs/` predate the brief and **stay there** — ruled at `G-02`, closed
2026-09-09. They are not indexed as brief documents, and the distinction is not filing:

> **A handover's value is that it was accurate on its date.** Inside `brief/` every claim answers to
> `EVIDENCE.md` and `check-brief` holds it there. Three of these four assert counts about a tree
> that has since moved — `139 tests` is now 231, `25 audit checks` is now 62, and one describes a
> branch state (`2 commits ahead, not pushed`) that no longer exists anywhere. Re-dating those
> numbers to today would destroy the only thing the document is for. Read each **as of its date**.

| Document | Date | What it settles |
|---|---|---|
| `docs/AUDIT_CENTRALISATION_2026-07-12.md` | 2026-07-12 | What was decentralised that shouldn't be — three pattern sweeps across `lib/`, `app/`, `components/`, every count classified per site and the top findings verified against `master` at `8d5259a`. Doctrine borrowed from the pleks centralisation audit of 2026-07-09 |
| `docs/CALENDAR_PIPELINE_HANDOVER_2026-07-21.md` | 2026-07-21 | Auto-fix removed, not disabled: the "Check & Auto-Fix" button replaced by propose → review → apply. **Renamed** 2026-09-09 — it was the one handover carrying no date, so it could not sort beside its siblings; the date is derived from the two SHAs it names and from its own first commit, all three `git log`-dated 2026-07-21 |
| `docs/CALENDAR_SYNC_HANDOVER_2026-07-21.md` | 2026-07-21 | Portal bookings vs Teams/Outlook invites. One reported symptom — a Tue 11:30 booking showing Wed 11:30 — opened into **four** distinct bugs, and the "~69 missing from Teams" connection check turned out to be measuring something else |
| `docs/SESSION_HANDOVER_2026-08-17.md` | 2026-08-17 | The P0/P1 sweep of the 2026-07-21 diagnostics, plus moving the repo out of OneDrive after it corrupted `node_modules` and then the git object store. Named by path in `CLAUDE.md` §1 as this project's session state, so it is load-bearing where the other three are history |

The three remaining files in `docs/` are addressed by name from code or config and cannot move at
all — the table in `../README.md` says which reader holds each one.
