# Current

> **Where the work is, right now.** Read at the start of every session; **written after every
> meaningful step**, before committing. A file that is only ever read goes stale in one session and
> then misleads the next.
>
> **Hard ceiling: 8 KB.** This is a handoff note, not a journal — it is read before every session,
> so its size is a per-session tax. Anything older than the current step is history: finished
> decisions go to `DECISIONS.md`, finished steps to `build/INDEX.md`, the rest nowhere.

**Active**: the lesson queue in `docs/LESSONS.md`, after canon's handover of 2026-09-10
(`dev-standards/docs/handovers/2026-09-10-life-therapy.md`, canon `6a0f5ed`, §6 at `69d6111`). Every
section of that handover is done.

**Pushed 2026-09-10, at Stéan's request: `1101e1f..46b8221`.** That carries the auth-flow fix
`1396829`, found while triaging L-72; the audit classifies every password setter
(`PASSWORD_SETTERS`). The deploy was **not verified from here**: this session's Vercel team lists
pleks, yoros and sterreveld, not life-therapy, which deploys from the repo owner's account. The repo
is public, so the details are in the session report and nowhere else. L-72 stays off the outbox
until Stéan says the review is done.

**Committed since the push, not pushed:**

- `a599577`: the audit's `code()` and `codeKeepingLiterals()` read the TypeScript parser
  (L-35 · L-49). Against the parser as oracle over 546 files, the regex version lost 700
  identifiers in 8 files; the new one loses 0, and agrees on all 4,381 comments. The audit's output
  was byte-identical after the swap. New check `audit: every source file parses`, probed. The cost:
  the audit runs about 1.5 s slower.
- `428ae56`, the records commit after it: §2 rows L-35 and L-49, L-57's row re-tensed, CF-4
  (L-41's tell belongs in canon's `check-handoff-contract`), and `docs/LESSONS.md` corrected. That
  entry's first measurement, 904 in 10, included 204 phantom losses from a lone `\r` in two files.
- `a1376ac`: four lesson citations canon cannot resolve. The two for the retired zero-padded ids
  carry `@no-such-lesson`. The two for L-100 are rephrased so they no longer read as citations.
  Canon's `check-lessons` now finds 0.
- The kit move: the eight rows canon pinned with review 2026-09-24, moved by each pin's route to
  canon `efbf834` (M-KIT-28). Each file's diff equals canon's own diff for it. The two dated
  `@probed-kit` twin records in `bash-gate` move to v4 with their dates kept. The one rewrite they
  back was measured equivalent. `check-kit-drift` reports all eight pins overtaken, and §3 of the
  outbox asks canon to drop them.

**Triage** (2026-09-10): 36 of 36 answered, queued or held. Batches `ba1cf4b`, `cb80e5d`,
`731682a`, `46b8221`. Findings to canon: CF-1 (the session-start query runs canon's working tree),
CF-2 (kit checks don't carry L-51), CF-3 (no spine version in the anchor), CF-4 (above).

**Queue, `docs/LESSONS.md`:**

- **L-41**: waits on canon (CF-4). Nothing to build here without forking a kit row.
- **L-68**: only Stéan can carry it: a standing authorisation in §7, in Stéan's own words, for the
  agent pipeline the host layer forbids "unless requested". Not to be written for them.

**Next action: wait.** Stéan decides whether to push the four commits above, and whether to write
the L-68 authorisation. Canon lifts the outbox from HEAD; when it replies with SHAs, rows
move to **Filed**. Before re-running `--emit-open`, check `git -C <canon> status --short tools`: if
it is dirty, run from `git archive HEAD` (CF-1).

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
