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
(`PASSWORD_SETTERS`). The repo is public, so the details are in the session report and nowhere else.

**Production was frozen from 2026-08-19 to 2026-09-11.** Every deploy failed from `566617e` on: a
client component imported Prisma, which only `next build` sees. The last success was `e48cd61`. It
was fixed in `4342b14`, pushed and deployed 2026-09-11, which released 76 held commits at once.
Deploy state IS readable from here: `gh api repos/RoxanneLT/life-therapy/commits/<sha>/status`.
Read it after every push. Since this change pre-push runs `npm run check:push`, which is `check`
followed by the production build.

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

**Pushed 2026-09-11, at Stéan's request: `fb1c669..28e9886`.**

- `c0fc378` carries L-68: Stéan's first authorisation, for agents.
- `beabdc0` moves `check-brief` to v7 by the route in canon's new pin. It also files four outbox
  items that canon answered: CF-1, and three kit rows whose pins canon dropped.
- `28e9886` adds Stéan's second authorisation to §7, for workflows and deep-research.

**Queue, `docs/LESSONS.md`:**

- **L-41**: waits on canon (CF-4). Nothing to build here without forking a kit row.
- **L-68**: carried 2026-09-11. Stéan gave the standing authorisation in their own words, and it
  is in `CLAUDE.md` §7. Agents, workflows and deep-research run on judgement without asking. A
  workflow stays under 15 agents and is announced in one line when it starts.

**L-72, second pass (2026-09-11, unpushed).** An independent walker review of `1396829` said stop.
It found more of the same class, and those are fixed in `64e00c3`, `7d89fc1`, `3ea8335` and
`0538d24`. The details are in the session report only. The re-walk at `3ea8335`
(`.handoff/l72-password-setters/02-walker.md`) says ✅ proceed, with low residuals. `0538d24` takes
two of them.

- Registration sets no password; it emails a link. Forgot password shares the core,
  `lib/account-link.ts`. A login is linked to its student only when the emailed token is spent.
- An admin's own password change needs the current one. The admin invite now sends its link.
- An admin's change to a client's email is audited.
- `PASSWORD_SETTERS` sees `createUser`, and every entry names its guard line. Four revert probes.
- Production, read 2026-09-11. The `account_created` row is the old default, so Roxanne resets it
  to default in admin to get the new copy. The step of `campaign_explore_portal` that carries the
  reset link sent 3 emails on 2026-08-19 with a dead button, and none were clicked.
- `security_update_password_require_current_password` was switched ON 2026-09-11 through the
  Management API, at Stéan's request, after `0538d24` was live. It was the only field changed.
  Recovery sessions are exempt in Supabase's source, so reset links still work.
  `mailer_autoconfirm` must stay off.
- The Outlook Safe Links property is now an audit check: a recovery link goes straight to
  `/reset-password`, and its token is spent only on submit.

**Next action:** Stéan's review of the L-72 work. L-72 stays off the outbox until Stéan says
the review is done. Then walk 02's Promote goes to §1, worded without exploit detail. Canon lifts the outbox from HEAD. Before re-running `--emit-open`, check
`git -C <canon> status --short tools`; if it is dirty, run from `git archive HEAD`.

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
