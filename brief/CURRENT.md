# Current

> **Where the work is, right now.** Read at the start of every session; **written after every
> meaningful step**, before committing. A file that is only ever read goes stale in one session and
> then misleads the next.
>
> **Hard ceiling: 8 KB.** This is a handoff note, not a journal — it is read before every session,
> so its size is a per-session tax. Anything older than the current step is history: finished
> decisions go to `DECISIONS.md`, finished steps to `build/INDEX.md`, the rest nowhere.

**Active**: canon's handover of 2026-09-10 (`dev-standards/docs/handovers/2026-09-10-life-therapy.md`,
committed at canon `6a0f5ed`, §6 added at `69d6111`). **Every section is done.** Nothing is pushed.

**Fixed, not pushed: waiting on Stéan's review.** Triaging L-72 turned up an auth-flow finding. It is
fixed in `1396829`, and the audit now classifies every password setter (`PASSWORD_SETTERS`).
Production runs the old code until that commit is pushed. The repo is public, so the details are in
the session report and nowhere else. L-72 stays off the outbox until Stéan has reviewed the fix.

**§6** (`05f544b`): `check-hook-registration` v3 adopted from canon's history, comment-only. The
outbox's §3 asks canon to drop its v2 pin.

**Triage finished** (2026-09-10). **26 dated · 5 n/a · 4 queued (three items) · L-72 held**: 36 of 36.

- Batch 1 (`ba1cf4b`) and 2 (`cb80e5d`): 12 dated, L-73 n/a. CF-2: canon's kit checks don't carry L-51.
- Batch 3 (`731682a`): 7 dated, L-59 and L-61 n/a. L-42 and L-43 carried by §8 prose (`691778f`).
- Batch 4 (the outbox commit after `415f480`): 7 dated, L-58 and L-65 n/a. Carried along the way:
  L-39 (§7) and L-64 (§3) as prose, L-47 (a §6 scar still read "open"), L-56 (`/walk` now spawns in
  the imperative). CF-3: the spines' anchor carries no spine version.
- Fixes the triage found in the audit: `b87ffe3`, `2afcb7a`, `ba98288`, each measured against the
  old version with plants, each diff's mutants killed.
- **Queued in `docs/LESSONS.md`, real work:** L-35 · L-49 (`code()` deletes real code in 10 files),
  L-41 (quarantine agent citations of files edited after dispatch), and L-68, which only Stéan can
  carry: a standing authorisation in §7, in Stéan's own words, for the agent pipeline the host layer
  forbids "unless requested".

**Next action: wait.** Stéan reviews `1396829` and decides the push, and says whether to write the
L-68 authorisation. Canon lifts the outbox from HEAD. When it replies with SHAs, rows move to
**Filed**. Before re-running `--emit-open`, check `git -C <canon> status --short tools`: if it is
dirty, run from `git archive HEAD` (CF-1).

**Watching:** canon pushing again — `node tools/apply-kit.mjs --project life-therapy` (dry run) and
`node tools/check-kit-drift.mjs`. Take bytes from canon's HISTORY, never its working tree.
`claude-md-ratio` is retired in canon; do not install it if an older manifest is ever read.

`G-01` and `G-03` are open and **deliberately not being chased**. Stéan set them aside on 2026-09-09.

**Decided mid-build, not yet in DECISIONS.md** — nothing.

**Do not touch**

- `C:\dev\dev-standards` — read-only from this project, in every direction. Never
  `apply-kit --write`; the dry run is the read-only way to read the plan.
- `docs/MECHANISABLE.md` and `docs/CANON-FINDINGS.md` **as paths** — the first is
  `check-claude-md`'s register, the second is lifted by canon from this repo's HEAD.
- `prisma/schema.prisma` — never modified without being explicitly told to (`CLAUDE.md` §5, M-01).
- The `KIT:CONFIG` region markers in any adopted kit file. Canon owns the bytes outside them, and
  editing a marker turns a tracked row into a silent fork.
