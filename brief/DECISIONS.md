# Decisions

> One row per settled question. Append at the bottom. **A reversed decision is struck through, not
> deleted** — the record of a closed gate is what stops it being re-asked.
>
> **Rotation:** past 40 rows or 25 KB, move rows whose subject no longer binds anything in the
> current tree to `decisions/ARCHIVE-<YYYY-MM>.md`. The test is mechanical: does any file behave the
> way it does because of this row? If not, it is history.

Seeded 2026-09-09. The rows below were settled before this file existed and are recorded here from
`CLAUDE.md`, its scars and the commit history — dated when they were *decided*, not when they were
transcribed. A decision that binds the tree today and is written nowhere a person reads first is a
decision waiting to be re-litigated.

| Date | Decision |
|---|---|
| 2026-08-17 | **The repository lives outside OneDrive, on every machine.** OneDrive destroyed the working copy — 118 git objects unreadable, `npm` unable to run. Git syncs the code; OneDrive syncs only what git ignores. Mechanised at the installer, which refuses any path containing "onedrive"; the drive letter stays per-machine and deliberately unwritten. Supersedes the retired checkout at `OneDrive/Websites/Life Therapy`, whose `.git` is damaged. |
| 2026-08-18 | **Schema changes go through the Supabase Management API, never `prisma migrate` or `prisma db push`.** `DATABASE_URL` is the pgbouncer pooler; the migration engine needs a direct connection for its shadow database and advisory locks. The pooler is correct for the app and the wrong channel for DDL. `.claude/rules/schema-changes.md` holds the working path. |
| 2026-08-18 | **A rule whose violation costs an incident gets a hook AND a check, never one.** The two layers have different apertures — a hook sees one tool call and reaches every context; a check sees the whole tree and catches what lands anyway. Settled by a scripted edit that changed a signature and not its guard: `tsc`, ESLint and 173 tests all passed, and only the audit caught it. |
| 2026-08-19 | **An email suppression decision names its tier — marketing, goodwill or account — and never branches on `emailPaused` at a send site.** The flag is set automatically by a cold-contact rule reading a tracking pixel; it means "we think they stopped reading", not "they asked us to stop". 65 of 181 clients were cut off by conflating those. `lib/engagement.ts` owns the three tiers. |
| 2026-08-19 | **A foreign URL is forwarded only if it exactly matches a Teams link already stored on a booking** — a lookup against data we hold, never a list of hosts we trust. Supersedes the host allowlist, which is the open redirector wearing a fix's clothes. |
| 2026-08-21 | **The gates are git hooks, not requests.** Until this date `npm run check` before commit and push was prose, with `.git/hooks/` full of `.sample` files and CI running a two-step subset — so the whole gauntlet ran exactly when a human chose to type it. `npm run prepare` wires `core.hooksPath`, and npm runs `prepare` on `npm ci`, so a fresh clone is gated by the install. |
| 2026-09-09 | **`C:\dev\dev-standards` is read-only from this project's sessions.** Two project sessions fixed defects inside canon while the estate session ran its gate against a MANIFEST changing underneath it — the result was not wrong but *unattributable*, which is worse because it still looks like a measurement. A finding about canon is worth more than a fix to canon. |
| 2026-09-09 | **Kit bytes are taken from canon's history, never its working tree** — `git show HEAD:<path>`, not `cp`. A sibling checkout is a live workspace; a file copied from it may be mid-edit and carry a version no commit holds. `check-claude-md` was taken at v14 from an uncommitted tree, committed identical within the hour, and the honesty was luck rather than method. |
| 2026-09-09 | **Prisma stays at 7.10.0 and four advisories are carried.** They are one subtree — the CLI — and npm's only fix is `prisma@6.19.3`, a major downgrade across the client, the pg adapter and the generated client. None of the four is reachable from a request this application serves. Reasoning and the re-check conditions: `docs/DEPENDENCY-ADVISORIES.md`. |
| 2026-09-09 | **This brief is tracked in git, not synced.** Supersedes the shape `pleks` uses — `brief/` as a gitignored symlink into OneDrive — on two grounds, either sufficient: the 2026-08-17 decision above, and that an untracked brief gives a fresh clone nothing for the gate to check. |
| 2026-09-09 | **A control this project's `CLAUDE.md` claims is held by this project, not inherited.** `@typescript-eslint/no-explicit-any` was in force only via the `next/typescript` preset while §4 claimed it as ours; `eslint.config.mjs` now names it. A preset is a dependency, a rule this file names is a decision — and the day the preset changes its mind, an inherited claim goes on reading as true with nothing behind it. |
| 2026-09-09 | **The four pre-brief handovers stay in `docs/`; they are indexed here, not migrated.** `G-02`, closed. A handover is accurate *as of its date* — inside `brief/` every claim answers to `EVIDENCE.md`, and three of the four carry counts about a tree that has moved (`139 tests` → 231, `25 audit checks` → 62, one branch state that no longer exists). Filing them where a checker holds them would force those numbers forward and delete the only thing they are for. `build/INDEX.md` lists all four with dates; `CALENDAR_PIPELINE_HANDOVER.md` was renamed to carry the date it had only in git. |
