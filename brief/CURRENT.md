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

**Pushed 2026-09-10, at Stéan's request: `46b8221..fb1c669`.** The audit reads the TypeScript
parser (`a599577`, L-35 · L-49) and its records (`428ae56`), four unresolvable lesson citations
(`a1376ac`), and the first kit move (`fb1c669`, canon `efbf834`). The commits carry the detail.

**Triage** (2026-09-10): 36 of 36 answered, queued or held. Batches `ba1cf4b`, `cb80e5d`,
`731682a`, `46b8221`. No findings left with canon: CF-1 was filed at `054eab2`, and CF-2, CF-3 and
CF-4 at `61bd006`.

**Kit move, pushed 2026-09-11 at Stéan's request (`bf62b2a..f936b77`).** Thirteen rows came
from canon's history at `2e79fdb`. The kit rows are bash-gate and its probe v6, agent-write-scope
and its probe v5, check-hook-registration v6, check-handoff-contract v5, check-install-platform v3
and check-claude-md v17. The spines, through propagate-spines, are census v10, db-inspector v5, grounder v7, implementer v5 and walker v8.
bash-gate's per-rule fallbacks are answered from existing settings, plus one added ask,
`Bash(gh pr merge*)`. Canon dropped all thirteen pins (`c06491c`). Measured by Stéan
2026-09-11: a settings ask prompts beside a live hook, so twins are live. The one silent hook ask,
on the spelling matching the mid-session `Bash(gh pr merge*)`, prompted after a restart: closed.

**Pushed 2026-09-11, at Stéan's request: `fb1c669..28e9886`.**

- `c0fc378` carries L-68: Stéan's first authorisation, for agents.
- `beabdc0` moves `check-brief` to v7 by the route in canon's new pin. It also files four outbox
  items that canon answered: CF-1, and three kit rows whose pins canon dropped.
- `28e9886` adds Stéan's second authorisation to §7, for workflows and deep-research.

**Queue, `docs/LESSONS.md`:**

- **L-41**: carried 2026-09-11 by the kit move. check-handoff-contract v5 prints the QUARANTINED tell.
- **L-68**: carried 2026-09-11. Stéan gave the standing authorisation in their own words, and it
  is in `CLAUDE.md` §7. Agents, workflows and deep-research run on judgement without asking. A
  workflow stays under 15 agents and is announced in one line when it starts.

**L-72, second pass (2026-09-11, pushed).** An independent walker review of `1396829` said stop.
It found more of the same class, and those are fixed in `64e00c3`, `7d89fc1`, `3ea8335` and
`0538d24`. The details are in the session report only. The re-walk at `3ea8335`
(`.handoff/l72-password-setters/02-walker.md`) says ✅ proceed, with low residuals. `0538d24` takes
two of them.

- Registration sets no password; it emails a link. Forgot password shares the core,
  `lib/account-link.ts`. A login is linked to its student only when the emailed token is spent.
- An admin's own password change needs the current one. The admin invite now sends its link.
- An admin's change to a client's email is audited.
- `PASSWORD_SETTERS` sees `createUser`, and every entry names its guard line. Five revert probes.
- Production, read 2026-09-11. The `account_created` row is the old default, so Roxanne resets it
  to default in admin to get the new copy. The step of `campaign_explore_portal` that carries the
  reset link sent 3 emails on 2026-08-19 with a dead button, and none were clicked.
- `security_update_password_require_current_password` was switched ON 2026-09-11 through the
  Management API, at Stéan's request, after `0538d24` was live. It was the only field changed.
  Recovery sessions are exempt in Supabase's source, so reset links still work.
  `mailer_autoconfirm` must stay off.
- The Outlook Safe Links property is now an audit check: a recovery link goes straight to
  `/reset-password`, and its token is spent only on submit.

**L-72 review done (Stéan, 2026-09-11).** Walk 02's Promote is outbox §2's L-72 row, worded
without exploit detail. Its LOW residuals 1, 4 and 5 were fixed the same day, unpushed: `02b0a2b`,
`68f5e71` and the audit commit after them. A guard that is a check now pins its refusal too.
Canon removed every pin at `c06491c`, and `check-kit-drift` from its HEAD shows no drift here.
The outbox holds CF-5: canon still calls a twin dormant.

**Next action:** none queued. Canon lifts the outbox from HEAD. Before re-running `--emit-open`,
check `git -C <canon> status --short tools`; if it is dirty, run from `git archive HEAD`.

**Watching:** canon pushing again — `node tools/apply-kit.mjs --project life-therapy` (dry run) and
`node tools/check-kit-drift.mjs`. Take bytes from canon's HISTORY, never its working tree, and run
its tools from `git archive HEAD` when `tools/` or `kit/` is dirty.
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
