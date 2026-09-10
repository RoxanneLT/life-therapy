# Current

> **Where the work is, right now.** Read at the start of every session; **written after every
> meaningful step**, before committing. A file that is only ever read goes stale in one session and
> then misleads the next.
>
> **Hard ceiling: 8 KB.** This is a handoff note, not a journal — it is read before every session,
> so its size is a per-session tax. Anything older than the current step is history: finished
> decisions go to `DECISIONS.md`, finished steps to `build/INDEX.md`, the rest nowhere.

**Active**: canon's handover of 2026-09-10 (`dev-standards/docs/handovers/2026-09-10-life-therapy.md`,
committed at canon `6a0f5ed`, §6 added at `69d6111`). §1 and §3–§6 are done; §2, the lesson
triage, is half done.

**Fixed, not pushed: waiting on Stéan's review.** Triaging L-72 turned up an auth-flow finding. It is
fixed in `1396829`, and the audit now classifies every password setter (`PASSWORD_SETTERS`).
Production runs the old code until that commit is pushed. The repo is public, so the details are in
the session report and nowhere else. L-72 stays off the outbox until Stéan has reviewed the fix.

**§6 done** (`05f544b`): `check-hook-registration` v3 adopted from canon's history, comment-only.
The outbox's §3 asks canon to drop its v2 pin.

**Triage so far** (2026-09-10, none pushed). **19 dated · 3 n/a · 3 queued (two items) · L-72
held**: 26 of 36 handled.

- Batch 1 (`ba1cf4b`): L-34, 40, 44, 50, 51, 54 dated; L-73 n/a. CF-2 filed: canon's kit checks
  don't carry L-51.
- Batch 2 (`cb80e5d`): L-48, 52, 53, 57, 69, 70 dated. L-35 and L-49 are queued as one item in
  `docs/LESSONS.md` (the audit's `code()` deletes real code in 10 files).
- Batch 3 (the outbox commit after `691778f`): L-36, 42, 43, 45, 55, 60, 66 dated; L-59, 61 n/a.
  L-41 is queued in `docs/LESSONS.md` (nothing checks an agent's citations against edits made
  after dispatch). L-42 and L-43 are carried by the §8 prose in `691778f`.
- Three of those dates are fixes the triage found: `b87ffe3` (email-tiers blind to SQL filters),
  `2afcb7a` (rate limits read off text), `ba98288` (`DATE_ALLOWLIST` exempted nothing, and its
  liveness test said otherwise). Each was measured against the old version with plants, and each
  diff's mutants are killed.

**Earlier the same day**: `2ea2ca6` PowerShell denied (M-KIT-22) · `bafd9e3` check-brief v5 ·
`6009d55` the outbox · `52af865` the ledger's new path, swept · `be03bc4` probe-checks asserts the
audit's exit code (L-51).

**Next action: batch 4.** Carrying-debt, writing-a-rule, environment and installing: L-39, 46, 47,
56, 58, 64, 65, 67, 68, 71. For each one:

1. Check `git -C <canon> status --short tools` first. **It was dirty today**, so the list came from
   `git archive HEAD tools ledgers` extracted to the scratchpad (CF-1). The HEAD run and the dirty run
   named the same 36 lessons.
2. Read each entry from its line (about 40 lines), measure this tree, and answer it with a date plus
   evidence, or with `n/a:` and a reason that argues it (with the search and its hit count when it
   rests on one). A lesson that applies and is **not** carried here is real work: queue it in
   `docs/LESSONS.md` or `docs/MECHANISABLE.md`, never in the outbox.
3. Write the answers to `docs/CANON-FINDINGS.md` §2 and commit one trigger group at a time. Canon lifts
   only committed answers.
4. Report *N dated · N n/a · N queued* along with the outbox SHA. Rows move to **Filed** when canon
   replies with its SHA.

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
