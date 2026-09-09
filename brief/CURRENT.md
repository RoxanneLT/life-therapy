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

**Next action** — decide `G-02`: whether the four dated handover documents in `docs/` move into
role folders here or stay as closed history. Nothing else in the kit is blocked; `claude-md-ratio`
is superseded and must never be installed.

**Decided mid-build, not yet in DECISIONS.md** — nothing.

**Do not touch**

- `C:\dev\dev-standards` — read-only from this project, in every direction. Never
  `apply-kit --write`; the dry run is the read-only way to read the plan.
- `docs/MECHANISABLE.md` **as a path** — `scripts/check-claude-md.mjs` addresses it by name as its
  register, and every `M-NN` pointer in `CLAUDE.md` §5 resolves into it.
- `prisma/schema.prisma` — never modified without being explicitly told to (`CLAUDE.md` §5, M-01).
- The `KIT:CONFIG` region markers in any adopted kit file. Canon owns the bytes outside them, and
  editing a marker turns a tracked row into a silent fork.
