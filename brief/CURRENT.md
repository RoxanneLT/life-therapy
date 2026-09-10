# Current

> **Where the work is, right now.** Read at the start of every session; **written after every
> meaningful step**, before committing. A file that is only ever read goes stale in one session and
> then misleads the next.
>
> **Hard ceiling: 8 KB.** This is a handoff note, not a journal — it is read before every session,
> so its size is a per-session tax. Anything older than the current step is history: finished
> decisions go to `DECISIONS.md`, finished steps to `build/INDEX.md`, the rest nowhere.

**Active** — canon's handover of 2026-09-10 (`dev-standards/docs/handovers/2026-09-10-life-therapy.md`,
committed at canon `6a0f5ed`). Five sections; four are done, the lesson triage is not started.

**Just done** (2026-09-10, none pushed)

- `2ea2ca6` — `"PowerShell"` denied in `.claude/settings.json` (M-KIT-22). Stéan's edit, confirmed
  theirs before committing. Every command gate here matches `Bash`; that tool walked around all of them.
- `bafd9e3` — `check-brief` v5, from canon's history, `names` region carried. Brief unchanged.
- `6009d55` — the outbox, `docs/CANON-FINDINGS.md` (template row `canon-findings`). §3 reports both
  adoptions. `brief/README.md`: five `docs/` files are addressed by name, one of them by canon.
- `52af865` — the ledger's path. Canon moved it to `ledgers/LESSONS.md` on 2026-08-20 and this tree
  taught the old one at 23 sites, including the audit's own fix text (L-99). The citations check got a
  detector for the old path, a narrowed zero-padding detector (the old one would have failed an honest
  `L-100`), a wider scope, and its first probe. `CLAUDE.md` §1 now says to query canon at session start
  rather than read the ledger. CF-1 filed: that query runs canon's working tree, which today was dirty.

**Next action — §2, the lesson triage: 36 of 99 open, L-34…L-73.** For each one:

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
