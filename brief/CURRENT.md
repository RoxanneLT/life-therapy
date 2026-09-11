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

**Pushed 2026-09-10, at Stéan's request: `46b8221..fb1c669`.** Nothing was on origin ahead of it.

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
- `fb1c669`, the kit move: the eight rows canon pinned with review 2026-09-24, moved by each pin's route to
  canon `efbf834` (M-KIT-28). Each file's diff equals canon's own diff for it. The two dated
  `@probed-kit` twin records in `bash-gate` move to v4 with their dates kept. The one rewrite they
  back was measured equivalent. `check-kit-drift` reports all eight pins overtaken, and §3 of the
  outbox asks canon to drop them.

**Triage** (2026-09-10): 36 of 36 answered, queued or held. Batches `ba1cf4b`, `cb80e5d`,
`731682a`, `46b8221`. Findings still with canon: CF-2 (kit checks don't carry L-51), CF-3 (no
spine version in the anchor), CF-4 (above). CF-1 was filed at canon `054eab2`.

**Committed 2026-09-11, not pushed:** `c0fc378`, which carries L-68, and the commit after it.
That one moves `check-brief` to v7 by canon's new pin's route and files four outbox items that
canon answered: CF-1, and three kit rows whose pins canon dropped. A third commit adds Stéan's
second authorisation to §7, for workflows and deep-research.

**Queue, `docs/LESSONS.md`:**

- **L-41**: waits on canon (CF-4). Nothing to build here without forking a kit row.
- **L-68**: carried 2026-09-11. Stéan gave the standing authorisation in their own words, and it
  is in `CLAUDE.md` §7. Agents, workflows and deep-research run on judgement without asking. A
  workflow stays under 15 agents and is announced in one line when it starts.

**Next action: wait.** Stéan decides whether to push the three commits above. Canon lifts the outbox
from HEAD; when it replies with SHAs, rows move to **Filed**. Before re-running `--emit-open`,
check `git -C <canon> status --short tools`: if it is dirty, run from `git archive HEAD`. Since
`054eab2` the tool warns on its own.

**Watching:** canon pushing again — `node tools/apply-kit.mjs --project life-therapy` (dry run) and
`node tools/check-kit-drift.mjs`. Take bytes from canon's HISTORY, never its working tree. On
2026-09-11 canon's working tree held an uncommitted `bash-gate` v5 and its probe. Drift run
there reports them; drift run from `git archive HEAD` does not. Adopt nothing until they are
committed.
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
