# Current

> **Where the work is, right now.** Read at the start of every session; **written after every
> meaningful step**, before committing. A file that is only ever read goes stale in one session and
> then misleads the next.
>
> **Hard ceiling: 8 KB.** This is a handoff note, not a journal — it is read before every session,
> so its size is a per-session tax. Anything older than the current step is history: finished
> decisions go to `DECISIONS.md`, finished steps to `build/INDEX.md`, the rest nowhere.

**Active** — adopting the dev-standards project kit. No band; the work is one row at a time against
`kit/project-kit/MANIFEST.json`, verified by `apply-kit --project life-therapy` (dry run only —
`--write` is never run from here) and `check-kit-drift`.

**Just done**

- **M-KIT-17 answered here**: `.claude/package.json` declares `"type": "module"` for that subtree,
  and `context-budget.js` + `statusline.js` converted. Canon left this fix open as Stéan's call and
  weighed two options; this is a third it had not considered, so it goes back as a finding along
  with ⑩ — `typelessHooks()` reads only the ROOT `package.json`, so it still reports this project as
  typeless after the fix, and would SKIP a project whose root says `module` while a nested file says
  `commonjs`. That second direction is the silent one.
- `bash-gate` v3 + probe v4 + the new `bash-gate.config.mjs`. `apply-kit` now reports **nothing to
  do** — the first time this project has been level with canon.

- `check-claude-md` **v15** adopted (canon `671b269`, taken from history), and the `dates-test`
  splice repaired by hand — canon repaired its own copy and cannot deliver that repair, because the
  damage is inside a `KIT:CONFIG` region and `apply-kit` carries a project's region rather than
  overwriting it. Same reason `POINTER`'s v15 widening had to be taken by hand; the four probes that
  fail without it are named in the region.
- `G-02` closed: the four pre-brief handovers **stay in `docs/`**, indexed at `build/INDEX.md` under
  *Before this brief existed* rather than migrated. `CALENDAR_PIPELINE_HANDOVER.md` renamed to carry
  the date it had only in git. Enumerating the four exposed a fourth reader `README.md` had not
  listed: `CLAUDE.md` §1 names `SESSION_HANDOVER_2026-08-17.md` by path.
- `brief` v1 + `check-brief` v4 seeded and wired. This file, and the four spine files beside it.
- `check-claude-md` v14 adopted and on the gate. Its first run found this project's own `CLAUDE.md`
  header comment closing 8 lines early, on a `-->` inside backticks in the entry that documents
  comment-stripping. Two `@enforced` markers were real overclaims and were fixed at the control.
- The `audit:` namespace is **overridden** in the checker's resolvers region, not merely added:
  canon's literal substring test resolved 1 of this project's 21 audit markers, and the 1 was a
  false positive matching a selftest fixture.
- 7 npm advisories classified, 3 fixed, 4 declined with the reasoning on disk.
- `bash-gate-probe` v3 with 7 verdicts tightened here; `dates` / `dates-test`;
  `agent-write-scope` trio; `check-handoff-contract` v3.

**Next action** — `bash-gate` v2 → v3 and `bash-gate.probe` v3 → v4, the only two rows still behind.
Both are `✗ conflict`, not merely stale: this project holds `KIT:CONFIG` regions canon does not
(`branch`, `branches`), so installing would delete configuration canon cannot express. Canon's
`671b269` ships a `✚ fresh` row that looks like the intended exit — `bash-gate-config`
(`.claude/hooks/bash-gate.config.mjs`), the same split `agent-write-scope` already took here. Read
that row before touching either file. **A conflict blocks the whole plan**, so nothing else can
install until these two are settled.

`claude-md-ratio` is retired in canon as of `671b269` — the row and the file are gone, and it was
never installed here.

`G-01` and `G-03` are open and **deliberately not being chased** — Stéan set them aside on
2026-09-09. G-01 cannot close until the desktop exists to point at; G-03 stays open because "don't
worry about it" is a deferral, and writing it into the Closed table as an answer would be putting
words in someone's mouth. The **open since** column is doing its job on both.

**Decided mid-build, not yet in DECISIONS.md** — nothing.

**Do not touch**

- `C:\dev\dev-standards` — read-only from this project, in every direction. Never
  `apply-kit --write`; the dry run is the read-only way to read the plan.
- `docs/MECHANISABLE.md` **as a path** — `scripts/check-claude-md.mjs` addresses it by name as its
  register, and every `M-NN` pointer in `CLAUDE.md` §5 resolves into it.
- `prisma/schema.prisma` — never modified without being explicitly told to (`CLAUDE.md` §5, M-01).
- The `KIT:CONFIG` region markers in any adopted kit file. Canon owns the bytes outside them, and
  editing a marker turns a tracked row into a silent fork.
