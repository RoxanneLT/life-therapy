# CANON-FINDINGS — what this project owes `dev-standards`

<!-- Kit row `canon-findings`, a TEMPLATE: yours after the copy, and never compared. Modelled on
     pleks's, which opened the first one on 2026-09-10 after a finding carried in a chat report went
     a session undelivered. -->

`dev-standards` is **read-only from this session** (`CLAUDE.md` §1), so anything owed to it is
written here, ready for an estate session to lift **verbatim**. Three things are owed to it, and
each has a section.

**This is an OUTBOX, not a register.** An item leaves when canon files it and drops to **Filed**
with the canon SHA that took it. An empty outbox is the healthy state.

⚠ **Never write "pending" anywhere canon will read.** `LESSONS.md`'s `Applied:` has exactly two
states — a date, or `n/a:` with a reason. A lesson you have not answered is not a value; it is an
open item in this project's queue, and it stays in the `--emit-open` list until it is answered.

---

## 1 · Findings about the method

A defect in canon — a playbook, a standard, a kit file, a check. The portability test decides
whether it belongs here or in this project's own scars: *would it still be true on a repo with a
different stack?*

```
### CF-1 · <the claim, in one line>
OBSERVED   what happened, in one sentence
COMMAND    what you ran, and its output verbatim
WHY IT IS  why it is the method's defect and not this project's
CANON'S
SMALLEST   the narrowest fix, and what it must not break
FIX
```

### CF-1 · The session-start query runs canon's working tree — the one place "take it from history" does not reach

```
OBSERVED   CLAUDE-MD-STANDARD (line 859) and CLAUDE_TEMPLATE §1 (line 95) tell every project to run
           `node <canon>/tools/check-lessons.mjs --emit-open`, which executes whatever is on disk in
           canon — and on 2026-09-10, while life-therapy's handover prescribed exactly that command,
           that file carried 42 uncommitted lines changing `--emit-open`'s output.
COMMAND    $ git -C C:/dev/dev-standards status --short
            M tools/check-lessons.mjs
           $ git -C C:/dev/dev-standards diff --stat tools/check-lessons.mjs
            tools/check-lessons.mjs | 42 ++++++++++++++++++++++++++++++++++++++++++
           $ git -C C:/dev/dev-standards archive HEAD tools ledgers | tar -x -C <scratch>/canon-head
           $ (cd <scratch>/canon-head && node tools/check-lessons.mjs --emit-open life-therapy) | wc -l
           79
           $ node C:/dev/dev-standards/tools/check-lessons.mjs --emit-open life-therapy | wc -l
           129
           Same 36 lesson IDs in both. The working tree adds what the other projects answered.
WHY IT IS  Canon's rule for kit bytes is "take them from HISTORY, never the working tree", because a
CANON'S    sibling checkout is a live workspace. Its session-start instruction runs a tool from that
           same workspace, on every project, on every stack. Today the difference was additive and the
           answer set agreed, so nothing was wrong — but nothing could have SAID so without a second
           run from HEAD, which is the 2026-09-09 incident's word: unattributable. Same class as
           finding ⑨ (drift reading canon's working tree), reached through a different tool.
SMALLEST   `check-lessons.mjs` prints one stderr line when `git status --porcelain -- tools ledgers`
FIX        in its own repo is non-empty: the output is from an uncommitted state, and the archive
           command to get the committed one. It must NOT refuse to run — canon's own session edits
           it legitimately, and a project session reading a warning is the whole fix — and nothing
           on any gate may start depending on it.
```

### CF-2 · Canon's kit checks do not carry canon's L-51 — no selftest runs the process the gate runs

```
OBSERVED   Every kit check life-therapy runs keeps a green --selftest with its main-path failure
           exit edited to 0: none spawns its own file, so the exit code the gate's `&&` chain reads
           is on no probe's path — L-51, in canon's own shipped bytes.
COMMAND    In life-therapy, each file clean at HEAD, one mutant at a time, restored with git checkout:
           the literal main-path `process.exit(1)` → `exit(0)` (selftests exit via `failed ? 1 : 0`,
           untouched), or the main-path ternary → `exit(0)` where there is no literal:
             scripts/check-claude-md.mjs          (v15, lines 1692, 1925)      → selftest exit 0
             scripts/check-handoff-contract.mjs   (v3,  line 406)              → selftest exit 0
             scripts/check-hook-registration.mjs  (v2,  line 367)              → selftest exit 0
                                                  (v3,  line 364, re-measured at adoption) → exit 0
             scripts/check-brief.mjs              (v5,  `failed.length ? 1 : 0`) → exit 0,
                                                  "selftest: all probes green (both directions)"
             scripts/check-install-platform.mjs   (v1,  `v.level === "fail" ? 1 : 0`) → exit 0,
                                                  "✅ probes green — reads both tree shapes, …"
           The same mutant on this project's own audit left all 15 of its planted probes green
           until be03bc4; it dies now.
WHY IT IS  The bytes are canon's outside KIT:CONFIG and identical in every adopter, so every project
CANON'S    running these rows has a gate member whose failure path is unprobed — and cannot add the
           probe without forking the row. A report that prints ✗ and exits 0 passes any `&&` chain,
           on any stack.
SMALLEST   Per check, one spawn of the file itself against a fixture root per distinct exit path,
FIX        asserting `status` — check-brief already spawns itself for `--status` (line 776), so the
           seam exists there. It must not spawn the real gate chain (L-34), and must not read the
           adopting project's tree, or a clean fixture stops being clean in some adopter.
```

### CF-3 · The spines' anchor carries no spine version, so L-39's cheap tell is out of reach

```
OBSERVED   Every spine states its version in a marker, and none of the five anchor templates asks
           the agent to copy it into the artefact. So an artefact cannot say which file its agent
           ran, and L-39 names exactly that as the first question to ask before diagnosing
           "disobedience".
COMMAND    $ grep -H "SPINE:" .claude/agents/*.md | grep -v "/SPINE"
           .claude/agents/census.md:<!-- SPINE:census v9 -->
           .claude/agents/crawler-doctrine.md:<!-- SPINE:crawler-doctrine v3 -->
           .claude/agents/db-inspector.md:<!-- SPINE:db-inspector v4 -->
           .claude/agents/grounder.md:<!-- SPINE:grounder v6 -->
           .claude/agents/implementer.md:<!-- SPINE:implementer v4 -->
           .claude/agents/walker.md:<!-- SPINE:walker v7 -->
           $ grep -n "^anchor:" <canon>/kit/agents/census.spine.md     (kit/agents clean at 69d6111)
           268:anchor: task=<slug> · agent=census · utc=<YYYY-MM-DDTHH:MM:SSZ> · commit=<short SHA>
           The same four fields in db-inspector, grounder, implementer and walker; crawler-doctrine
           has no anchor (its stdout is one JSON object).
WHY IT IS  The spines are canon's bytes and `check-agent-spines` verifies them against canon, so no
CANON'S    adopter can add the field without forking the row. The trap is the harness's, not a
           stack's: every project that edits a spine and spawns within the same turn meets it.
SMALLEST   Add `spine=<name> v<N>` to the anchor template, copied from the file's own SPINE marker.
FIX        That is L-39's refinement exactly: a version the agent must write as part of work it
           already does, not an aside it can skip as noise. `check-handoff-contract` can then
           compare the stamped version with the spine at the anchor's commit. It must NOT fail an
           artefact written before the field existed (they have none), and must not read the spine
           from the working tree: an in-turn edit is the case it exists to expose.
```

---

## 2 · Lesson answers

From `node <canon>/tools/check-lessons.mjs --emit-open <project>`. Read the entry before answering.
A date is the day this project's tree came to carry the lesson, with the evidence that shows it; a
reasoned `n/a:` closes an item as surely as a date. "Not yet" is not an answer — leave the lesson
off this table and it stays open.

| Lesson | Answer — `YYYY-MM-DD` or `n/a: <reason>` | Evidence — SHA, path or command |
|---|---|---|
| L-34 | 2026-08-21 | `7ca62aa` — `scripts/check-git-hooks.mjs` proves each hook's seam inert by letting the hook resolve AND invoke `npm run check` against an `npm` shimmed first on `PATH`, never the real chain, and asserts the shim was reached (`:168-206`), so a hook that echoes the right command and runs another fails |
| L-36 | 2026-08-20 | `06bfdb5` — every spine's turn budget is sized from its own role, never from an aggregate, and each records its n: implementer 250 (median ≈ 196, 10 runs), walker 150 (≈ 118, 6), grounder 150 (≈ 100, 5), census 150 (≈ 62, 5), db-inspector 40 ("n=1, so this is a first value, not a distribution"). Each is "a backstop, not a target", set off the tail. `npm run agents:distribution` (`8877cde`, the same day) reports medians per type and counts nested runs separately by depth, so a fan-out cannot merge two populations into one median |
| L-39 | 2026-09-10 | `a59a59c` — the ledger marks this trap as live here and unrecorded, and it was. §7 now says a spine edit takes effect at the next turn, not the next spawn, and that an agent seeming to ignore a fresh edit is a version question first. The reload timing is cited as pleks's measurement (E9), a harness fact, not re-measured here. What would make it detectable is canon's, since the anchor carries no spine version: CF-3 |
| L-40 | 2026-08-19 | `6478de1` — `audit: a check that says it scans raw actually scans raw` turns the audit on its own source, reconciling each check's stated raw/`code()` choice against the read it performs; `check-claude-md --selftest` runs the marker audit over its own file. **Not a clean bill**, as pleks's line says of pleks: no survey has run every control here against its own rule. One member is live and reasoned: the citations check exempts its own file, because it documents the shapes it hunts (`scripts/architecture-audit.mjs`, `DOCUMENTS_THE_SHAPES`) |
| L-42 | 2026-09-10 | `691778f` — §8 had split *does* claims (anchored) from *should* claims since `c33bd2e` (2026-08-18). That is the split pleks had when this happened, so it is not the carry. The lesson's addition is now written there: a *does* claim rests on the code site, and a spec, plan or ruling saying the code does X is intent, labelled so. No mechanism, as the entry says. The brief's rulings already name their site: each `brief/DECISIONS.md` row cites the file or commit that holds it |
| L-43 | 2026-09-10 | `691778f` — §8 now says to verify by changing the method (resolve the type, follow the call, run the code), and names the absence claim as the dangerous shape. Before it, the nearest carries were walker step 9 (`b0d525b`), which is reproduce-before-report rather than change-the-route, and the probes' known-good half, which catches the sibling failure (a token matching what its author did not model). This triage worked that way: each "0" was first checked against a known positive (the L-50 row), and the L-52 and L-53 fixes were measured by planting into the tree, not by re-reading the audit's patterns |
| L-44 | 2026-08-21 | `7ca62aa` — a mutation test found a live mutant: deleting `git write-tree` from `pre-commit` left every probe green, because each supplied the marker itself. The producer-side probe was added in response, and the finding is recorded at `scripts/check-git-hooks.mjs:95` |
| L-45 | 2026-09-10 | measured, counting across sessions rather than within one. The statusline reads no mode field, only `input.model` (`.claude/statusline.js:54`), so the scar's shape is absent. The one transcript field this repo's tooling reads as a changing state is `spawnDepth` (`scripts/agent-distribution.mjs:120`). Across 130 subagent sidecars under `~/.claude/projects`: `"spawnDepth":1` ×125, `"spawnDepth":2` ×5 (all pleks). Two values, so it reports a state, and §7's "every run top-level" is a true reading of a field that varies, not an unset default |
| L-46 | 2026-09-10 | measured: every ignore list read against what it covers today. ESLint has three entries: `next-env.d.ts`; `prisma/**` (SQL migrations and the schema, 0 TS or JS files); and `lib/generated/**` (0 tracked files, generated at install). `.claude/**` is NOT ignored: `npx eslint .claude/hooks/bash-gate.js .claude/statusline.js --max-warnings 0` → clean, with no "file ignored". knip's one entry, `components/ui/**`, carries its reason and calls itself the entry most likely to rot. tsconfig's `_to_delete` names a folder that no longer exists (0 tracked; a gitignored scratch convention, `9684121`), so it hides nothing. The audit's walk skips dot-directories and `generated` only inside its roots, where `git ls-files` finds 0 such paths. The audit's own allowlists fail when an entry stops suppressing (`allowlists: every exemption is still load-bearing`) |
| L-47 | 2026-09-10 | `a59a59c` — found by this triage. The gate-denied-its-own-commit scar in §6 ended on "the multi-line door stayed open". `ad48fa2` closed that door on 2026-09-09 and re-tensed the narrative at its site (`.claude/hooks/bash-gate.js`, "the prose case cannot return"), because §6 keeps each narrative at its code site and the fixing diff reached it. The §6 bullet was the part no diff reached, and it now names the closing SHA. Swept the rest of §6 for open-work phrasing (`open`, `not yet`, `still`, `todo`, `remains`, `pending`): 4 hits, three in another sense ("an open", "open redirector" ×2), the fourth the bullet above |
| L-48 | 2026-09-10 | `b87ffe3` — found by this triage. The email-tiers check watched `if (…emailPaused)` branches at send sites, and the birthday scar's own path was a QUERY: `where: { emailPaused: false }`, planted in `lib/birthday-process.ts`, read ✓. A second arm now fails any file filtering `emailPaused: false` in SQL, outside an allowlist of the three marketing queries (each carrying its reason, and failing when it stops filtering). probe-checks plants the scar's regression by name. The same class, earlier: `ddl-gate` (2026-08-18) gates DDL written to a file because `bash-gate` saw only the command line, and `2ea2ca6` denies the PowerShell tool, which no Bash-matching hook sees (M-KIT-22) |
| L-50 | 2026-09-10 | verified present, measured by pattern across `scripts/` and `.claude/`: `ok(` with an emptiness test left of `\|\|`/`&&` → 0 hits; empty `catch {}` → 0; single-line `for … of … ok(` → 0. The one `ok(A \|\| B)` (`scripts/check-context-budget.mjs:237`) takes the OR over a fixture's output, not live state, and the next line pins the exact count. `check-handoff-contract` names its zero-file live pass on every run rather than printing a bare tick |
| L-51 | 2026-09-10 | `be03bc4` — found by this triage and **demonstrated by mutation**: with the audit's final `exit(1)` changed to `exit(0)`, all 15 planted probes stayed green. `probe-checks` now asserts the exit code both ways. `check-import-cycles` spawns itself once per exit path; flipping both of its failure exits turns two probes red. The five canon-owned kit checks carry the same gap and cannot be fixed here: CF-2 |
| L-52 | 2026-09-10 | `2afcb7a` — found by this triage. Three guards took a rate limit from TEXT: `/rate-?limit/i` in the route-group regimes, the same alternative in the API-route check over raw text, and the MFA check's `/isRateLimitedDb\|checkAndRecord\|rate-limit-db/`, also over raw. Four plants, measured one at a time against both versions. Three passed the old audit at exit 0: `clearRateLimitDb(` (the call that LIFTS a limit), a comment naming `requireRole()`, and the module's import path. The fourth, a real throttle imported under an alias, was reported unguarded. Now: a classified `THROTTLES` list, a name counted only as a call over `code()` and only where the file imports it from its module (aliases followed), and liveness against the module's exports. Seven mutants from the diff, seven killed |
| L-53 | 2026-09-10 | `ba98288` — found by this triage. Of the audit's named lists, six were read by more than one check (scan in the commit message). The one borrow was in `allowlists`: `DATE_ALLOWLIST`'s liveness test ORed in a wider slice pattern and the `+02:00` rule's detector over raw text, a criterion the list never admits by. Against the two date checks' own detectors, all four entries exempted nothing. Two were kept green only by comments explaining why their files do NOT write "+02:00". Planted in `lib/graph.ts`, a local-midnight constructor left the audit at exit 0. The list is now empty, the ISO patterns are one constant read by the check and by its liveness test, and seven mutants from the diff are killed |
| L-54 | 2026-09-10 | `be03bc4` — mutants enumerated from `52af865`'s DIFF, not its commit message: each of the three widened walks dropped, each of three detectors disabled, and the narrowed one widened back to `\d{3,}`. Seven killed, of seven. Before that, the three walk mutants had survived. Two runner features came out of it: `named` plants (a plant must be named under a ✗) and `quiet` plants (a plant must not be). Held by attention, as at pleks — no mechanism enumerates a diff's hunks |
| L-55 | 2026-08-19 | `d1bcd71` — the source-enumeration floor: "an empty walk would have passed all 45 in silence and printed a reassuring green". A clean audit now counts only if the walk read at least 400 files (542 then), and deliberately not `> 0`. The comparison the entry asks for is built into the gate: every commit runs `test:probes`, which scores planted violations that must fire beside the same checks with the plants removed, so the harness is measured each time the tree is. The too-good reading turned up once in this triage: `DATE_ALLOWLIST`'s liveness said all four entries were load-bearing, and none was (`ba98288`) |
| L-56 | 2026-09-10 | `a59a59c` — found by this triage: `/walk` described delegation rather than doing it. It said to spawn the walker and "fold its findings in", with a full stop after the spawn, and that claims "go to the `census` agent". Now: spawn the walker in the background first, then work steps 1–3 yourself while it runs; and "spawn one `db-inspector` per live-data claim and one `census` per pattern claim, all in a single message so they run concurrently" |
| L-57 | 2026-07-12 | `821fe93` — the audit reports a check that throws as `✗ crashed`, never as a pass, and the hooks that gate a tool call fail to a prompt (`8d5259a`): unparseable or non-object input asks, and bash-gate sets a reason even on allow, "because an empty reason makes an allow indistinguishable from a hook that ran and decided nothing". Later splits of the same bucket: the source-enumeration floor, `d1bcd71` (2026-08-19, "every other check is scanning almost nothing and passing"); check-brief's `N of 9 not measured`, `8d3d6b7`; check-handoff-contract naming its zero-file pass. Every probe runs on every commit (`test:probes`, `test:gate`), so none is a photograph. **One known collapse is queued, not carried:** where the audit's `code()` desyncs, "no findings" and "could not read" are one reading. That is the L-35 · L-49 item in `docs/LESSONS.md` |
| L-58 | n/a: nothing here rebuilds a tree from recorded edits. Recovery is git, which every write channel passes through, and §7 has the caller read `git status` before committing an agent's tree. The one figure derived from a transcript, context-budget's running cost, marks itself partial when its read has a gap, and the mark reaches the rendered line (" since tracking began", `.claude/hooks/context-budget.js:311, 344`) | `git grep -ciE "rewind\|checkpoint\|reconstruct\|replay" -- scripts .claude .githooks docs brief CLAUDE.md` → 14 hits in 9 files, none a reconstruction: rebase replays (the hook, its probe, CLAUDE.md), "replaying" as re-running queries in two spines, two audited scripts that keep changes "reconstructable", a calendar test replaying an approval, and the context-budget pair |
| L-59 | n/a: nothing here infers from wording which process or condition produced an output. There are no experiment arms and no blind probes, and every check matches code shapes or the markers this repo defines | `git grep -niE "\bblind\b\|\barms?\b.{0,20}(experiment\|probe)\|discriminat" -- scripts docs .claude brief` → 10 hits before this row was written, none an experiment or a discriminator ("blind spot", "edit-blind", a resolver that "discriminates"). `docs/` has no experiments file |
| L-60 | 2026-08-28 | `b0d525b` — walker step 9, *reproduce before you report*: every finding carries `REPRODUCED` or `UNREPRODUCED`, naming the instrument, and `UNREPRODUCED` says what was tried, "never that you did not try" (`.claude/agents/walker.md:123-150`). Adopted with canon's pipeline protocol |
| L-61 | n/a: no before/after quality comparison of an intervention exists here. The nearest shape, re-judging the 65 auto-paused clients, scored them by clicks and account activity rather than by the tracking pixel that paused them. That is the independent detector the entry asks for (CLAUDE.md §6, `scripts/review-auto-paused.ts`) | `git grep -niE "before.{0,15}after\|pre-?regist" -- docs brief scripts .claude`, minus "before every/any/the…" → 5 hits before this row was written, none a quality comparison: a byte count before and after an edit (×2), a missing-count held at 0 across deletions, a checker's own output, an audit row's before/after state |
| L-64 | 2026-09-10 | `415f480` — §3 now says hooks load at session start from the launch folder. That matters here because this repo sits beside its siblings under one parent, and a session opened there loads none of its gates. It says to restart after a hook changes and to confirm with a call no settings rule covers (`cd scripts && ls`: `bash-gate` → `"permissionDecision":"allow"`, measured), and that only the operator can see a prompt |
| L-65 | n/a: life-therapy was never greenfield. Its controls were built against a live codebase (the audit centralisation of 2026-07-12, the gates in August), so no control was deferred for want of code | `git grep -niE "nothing to govern\|no codebase" -- CLAUDE.md docs brief` → 0 hits |
| L-66 | 2026-08-19 | canon `bd58b28` registered life-therapy after its six agent files already existed (`8d5259a`, 2026-07-12). `node tools/check-agent-spines.mjs` in canon → `6 spine(s) × 4 project(s) — 18 verified, 0 pinned, 6 not visible`, and all six not-visible lines are dev-standards' own copies, none life-therapy's |
| L-67 | 2026-09-09 | `ad48fa2` — `check-handoff-contract` v3 reads its glyph set off the spines, which is the entry's own resolution, and its header records the playbook divergence. Nothing here prints a second copy: `git grep -nE "✅ proceed\|⚠️ decision\|⛔ stop\|Verdict +[✅⚠⛔]" -- CLAUDE.md docs brief .claude/commands` → 0 hits. The one restatement, §7's five labels, matches the checker's `LABELS` exactly (`scripts/check-handoff-contract.mjs:57`) |
| L-69 | 2026-09-09 | `d1509b7` — `dev-standards` is read-only from this project's sessions (CLAUDE.md §1, a floor held by attention), so no change made here lands in canon. A finding goes to this outbox, and canon's own session lifts it, makes the change and runs canon's gate. The one canon tool this session runs is `check-lessons --emit-open`, from canon's HEAD, and its whole output is read |
| L-70 | 2026-08-19 | `4e540c6` — the fourth of the four tier-0 slots entered the gate chain: `tsc --noEmit` (`6f0f867`, 2026-06-24), `eslint . --max-warnings 0` (`821fe93`, 2026-07-12), knip as `crawl:tier0` (`21490a4`, 2026-08-18), `check:cycles` (`4e540c6`). All four are in `npm run check`, and the git hooks run that on every commit and push (CLAUDE.md §3) |
| L-71 | 2026-09-10 | `2ea2ca6` denies the PowerShell tool, the shell the entry's corruption came through. The shell that remains was measured rather than assumed: Git Bash's `sed -i` on a file holding `— § ⚠ · é` changed only its ASCII target, and `cmp` against the expected bytes → identical. Mojibake scan of every tracked file (`git grep -lP` for the UTF-8-read-as-1252 sequences of `—`, `§`, `⚠`) → 0 files. No `.ps1` in the repo |
| L-73 | n/a: no member of this gate reads build output. Every check reads source, the working tree or git, so the rendering strategy cannot narrow what any of them sees. The content rules here (money, dual-domain, dates) walk `app/`, `lib/` and `components/` as source, and that includes every dynamic route | `git grep -nE "\.next/\|dist/\|out/\|build-manifest\|prerender-manifest" -- scripts .githooks package.json` → 3 hits, none a build artefact: `checkout/route.ts` twice (substring `out/`) and `timeout/` once |

---

## 3 · Kit reports

Adoptions canon has to record in `kitAdopted`, and pins: a row deliberately behind canon, with the
row id, the version held, the reason, and a review date. A pin means *read and deliberately behind*,
never *exempt*, so the reason has to argue it.

| Row | Version | What | Evidence |
|---|---|---|---|
| `check-brief` | v5 | adopted 2026-09-10, from canon's history at `6a0f5ed`, `names` region carried | `bafd9e3` · `apply-kit --project life-therapy` → `= identical check-brief` · live run `brief: conformant · 1 of 9 not measured` |
| `canon-findings` | v1 | adopted 2026-09-10 — this file, a template, copied from canon's history at `6a0f5ed` | the commit that adds this file |
| `check-hook-registration` | v3 | adopted 2026-09-10, from canon's history at `69d6111` (handover §6). Comment-only: LT's copy was byte-identical to v2 with no `KIT:CONFIG` region, so there was nothing to splice. **Canon's v2 pin on this row is now finished work: drop it from `ledgers/projects.json`** | the commit that adds this row · `git -C <canon> show HEAD:kit/project-kit/scripts/check-hook-registration.mjs \| cmp - scripts/check-hook-registration.mjs` → identical · `--selftest` → `✅ probes green`, and the live run is green · `check-kit-drift` → `life-therapy: the check-hook-registration pin is STALE IN THE AHEAD DIRECTION — the pin says v2 and scripts/check-hook-registration.mjs is at v3`. `apply-kit --project life-therapy` still prints `📌 pinned … an argued lag`: the pin returns before any bytes are compared, so that tool cannot confirm this adoption until the pin goes |
| `settings` | v3 | the M-KIT-22 claim is now committed here — `"PowerShell"` in `permissions.deny`. Nothing to record in `kitAdopted` (the row is asserted, not adopted); listed so canon sees the claim is held by a commit and not by a working tree | `2ea2ca6` |

No pins.

---

## Filed

A pointer, not a restatement — the canon entry is the record.

| # | Item | Filed as | Canon SHA |
|---|---|---|---|
