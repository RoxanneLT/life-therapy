/**
 * bash-gate.js — PreToolUse gate for Bash. KIT FILE, install at `.claude/hooks/`.
 *
 * @kit bash-gate v6 — tracked OUTSIDE its `KIT:CONFIG` regions. Those regions are yours;
 * everything else is canon's, and `check-kit-drift.mjs` reconciles it.
 *
 * WHY THIS EXISTS, and it is not the reason you would guess. Allow-rules in
 * settings.json cannot cover commands containing `$()` substitution, heredocs,
 * or multiline awk/node bodies — Claude Code's injection analysis decomposes
 * them and prompts regardless of any allow rule, which stalls an unattended
 * session on `ls`. A PreToolUse hook answers BEFORE the permission system, so
 * `allow` skips the prompt. It exists for session friction first and danger
 * second, which is why `0-GREENFIELD.md` phase 0.4 installs it on day ZERO,
 * before there is any code to protect.
 *
 * POSTURE: ALLOW EVERYTHING EXCEPT the named gates. The ALLOW cases matter more
 * than the DENY cases — a gate that over-matches has failed at its job while
 * looking maximally safe. Every rule below is a TOKEN test at COMMAND POSITION
 * inside one shell SEGMENT, never a substring test on the whole string, because
 * every false-deny this file's ancestors recorded came from one of three shapes:
 * a pattern spanning `&&`/`;`/`|` into a neighbouring command, a verb matched
 * inside prose or a quoted argument, or punctuation touching the target
 * (`\rm`, `(rm`, `/"*"`). Segments, normalised tokens and a position check
 * remove all three at once. ONE rule also reads the segments BEFORE its own, and only to learn
 * which branch its segment lands on: the protected-branch ask (v5, below).
 *
 * v2 (2026-09-08) is the harvest of four field copies. Measured before it:
 * canon ALLOWED `git push -f`, `\rm -rf /`, `(rm -rf /*)`, `rm -rf /"*"` and
 * `git commit --no-verify`; false-DENIED `rm -rf .next && du -sh /`; and ASKED
 * on `git fetch origin main && git push origin feature/x` with a reason that
 * named the wrong segment. Each is a probe case now.
 *
 * v5 (2026-09-10) is yoros's measurement of v4: the protected-branch gate asked only when a command
 * NAMED the branch, so the ordinary deploy sequence — `git checkout main && git merge x && git push`
 * — was allowed end to end, and `git push origin +main` force-pushed it. The branch a segment lands
 * on is now resolved (see "WHICH BRANCH" below), and a `+refspec` is a force-push.
 *
 * v6 (2026-09-11) is yoros CF-4: a fallback was declared per FILE, so one `@twin` passed a hook
 * holding nine rules with no floor behind eight. Every rule now carries its own — see "WHAT STANDS
 * BEHIND EACH RULE" below — and `node bash-gate.js --fallbacks` lists them for the checks to read.
 *
 * A REASON IS ALWAYS SET, INCLUDING ON ALLOW. An empty reason makes an allow
 * indistinguishable from a hook that ran and decided nothing.
 *
 * IT FAILS TO A PROMPT, NEVER TO SILENCE. Unparseable input asks, and so does
 * valid JSON that is not an object: `JSON.parse` accepts a bare string, and
 * reading `tool_input` off one yields `undefined` and a silent allow. That hole
 * shipped green in two projects' copies behind probes that never sent one.
 */
// @event PreToolUse
// @matcher Bash
// @rule-fallbacks --fallbacks

/* KIT:CONFIG twins — the settings.json `ask` rules that back the ASK gates below.
 * `check-hook-registration.mjs` reconciles these against settings, so every @twin
 * here must exist there and vice versa. Declare a @no-twin with its reason instead
 * where a coarse settings pattern would be WRONG rather than merely redundant. */

// A TWIN IS LIVE, NOT DORMANT. Measured 2026-09-11 on Claude Code 2.1.235 by Stéan, who alone
// sees prompts (L-64). With this hook alive and answering allow, `git merge --abort` PROMPTED
// through `Bash(git merge*)`. So a settings ask beats the hook's allow, as the permissions docs
// say, and yoros measured the same that morning. Each twin costs a prompt wherever it is wider
// than its rule: here `curl*`, `git merge*` and `git clean*`, all rare in this repo's work.
// The 2026-08-18 measurement said the opposite: a bare curl ran with no prompt beside
// `Bash(curl*)`. It recorded no harness version, so it cannot be re-run as it was. It stays
// here as history, contradicted.
//
// The same session measured the hook's own verdicts. An ASK prompted on its own
// (`git pull origin <branch>` on master, `gh -R <repo> pr merge`, `git push <remote>`,
// `vercel`), and a DENY blocked. ONE ANOMALY IS OPEN: `gh pr merge 99999 --repo <repo>` did
// NOT prompt, twice, though the hook asked. It is the only spelling tested that also matches
// `Bash(gh pr merge*)`, the one ask added mid-session. `git push` and `vercel` match asks loaded
// at session start, and both prompted. Next: re-run it after a restart. Until then, do not assume
// that a twin leaves the hook's ask intact.
//
// What a twin is FOR is unchanged. It matters most when this hook is dead: its script path
// broken, its failure reported as a non-blocking status nobody reads. Then settings is all there
// is, and every rule held here alone degrades WITHOUT FAILING. Deny silently becomes ask, and ask
// silently becomes allow.
//
// Consequence for testing. A twin can be seen while the hook is alive only on a command the hook
// ALLOWS; where the hook denies, it answers first. Verifying the floor for a rule this hook holds
// means disabling the hook and re-running the command, which also rehearses the one situation the
// twin exists for. That is what
// the `@probed` records below are: each names the date, the disabled-hook observation, and
// the exact command. The `@probed-sha` is the rule text's hash at probe time, so an edited
// rule invalidates its own probe record instead of inheriting it.
//
// The pairing is deliberately ASYMMETRIC, and equal-or-stronger would be wrong.
// settings.json speaks in prefix-globs; this file speaks in segment-aware token tests. A
// coarse DENY in the dumb layer false-positives forever and cannot be taught better. A
// coarse ASK puts a human in the loop exactly when the smart layer is gone, and costs only
// an occasional prompt while it is alive. ASK IS THE FLOOR. ABSENT IS THE VIOLATION.
// If a twin prompts too often, NARROW its pattern — never delete it.

// TWO BINDINGS, because this file now has two kinds of rule and one kind of record cannot
// speak for both. A probe record must bind to WHAT IT PROBED, or "re-probe on any edit" is
// undetectable — nothing notices the edit.
//
//   `@probed-sha <6hex>`  binds to the rule body DIRECTLY BELOW the marker. Used for this
//                         project's own rules, which live inline in the KIT:CONFIG deny/ask
//                         regions below, where the marker can sit beside the thing it covers.
//   `@probed-kit <id> vN` binds to the KIT VERSION. Used for CANON's rules, whose bytes this
//                         project does not own and cannot edit: `check-kit-drift.mjs`
//                         guarantees they are byte-identical to canon, so the only way one can
//                         change is a canon version bump — and that is what to re-probe on.
//                         A line hash would be the wrong instrument here, because canon's
//                         rules are deliberately NOT adjacent to their twins in the kit layout.
//
// Adopting kit bash-gate v2 on 2026-09-09 rewrote every rule from this project's separator-aware
// regexes to canon's token tests, which invalidated all seven sha records at once. COVERAGE WAS
// RE-VERIFIED BY HAND rather than re-hashed silently: each twin below was read against the rule
// it now backs, and the settings patterns themselves are UNCHANGED — so the 2026-08-19
// interception measurements, which are statements about settings.json and not about the hook,
// still stand. What could not be inherited is recorded as `never`.
//
// v3, later the same day, invalidated the two dated records again — and this time the re-verification
// is a MEASUREMENT rather than a reading. `diff` of this file at v2 against v3, with comments and
// blank lines excluded, yields exactly four deletions and one addition, all of them the branch
// config becoming an `import` from `bash-gate.config.mjs`. `isForcePush`, `LETHAL_TARGET` and the
// whole of CANON_DENY — everything these two twins back — are byte-identical across the version
// bump. So the coverage argument below is not merely still plausible, it is unchanged by
// construction, and `@probed-kit` moves to v3.
//
// ⚠ THE DATES DELIBERATELY DO NOT MOVE. `@probed` records WHEN THE INTERCEPTION WAS OBSERVED, and
// no new observation was made — the hook was not disabled and no force push was attempted. Bumping
// the date to today would manufacture a measurement out of a version bump, which is the precise
// failure this whole record format exists to prevent.
//
// v4 (2026-09-10, canon M-KIT-28) touched one thing these twins back: `SHORT_CLUSTER_WITH_F`, which
// `isForcePush` reads, was rewritten from `[A-Za-z]*f` to `[A-Za-eg-z]*f` to stop it backtracking.
// Equivalence was MEASURED, not read: both forms against every string of length 0-7 over
// `- f F a u z e g 1 = _` gave 21,435,888 strings, 81,270 matches and 0 disagreements. The three `\w`
// rewrites are equal to `[A-Za-z0-9_]` on every BMP character (0 disagreements). `LETHAL_TARGET`
// and CANON_DENY are byte-identical. The heredoc masker's loop was restructured; the gate's two
// bash-gate suites exercise it. `@probed-kit` moves to v4 and the dates stay, as at v3.
//
// v5 and v6 (canon `a152e89`, `2e79fdb`, adopted 2026-09-11) left what the two dated twins back
// alone. The code-only diff of canon's v4 against its v6 comes from the TypeScript scanner, with
// comments and blank lines dropped. It has no hunk in `isForcePush`, `FORCE_LONG`,
// `SHORT_CLUSTER_WITH_F`, `isDestructiveRm` or `LETHAL_TARGET`. CANON_DENY gains `isForceRefspec`,
// another deny, so no force-push decision changes. `fires` now passes a context that none of these
// rules reads. `@probed-kit` moves to v6 and the dates stay.
//
// v6 also moved each twin ONTO the rule it backs, as the `fallbacks` region below and the third
// element of every project entry. That third element is data: `decide()` destructures
// `[rule, why]` and never reads it. Adding it still changed the text the audit hashes, so the five
// dated `@probed-sha` records below were re-recorded that day, with their dates unchanged and
// their predicate and reason bytes identical to the probed ones (`git diff` shows only the added
// element).

// ── Backing CANON's rules (CANON_DENY / CANON_ASK — not this project's bytes) ──
// @twin Bash(git push --force*)
// @probed 2026-08-19 hook-disabled: intercepts — denied · `git push --force --dry-run`
// @probed-kit bash-gate v6
// Settings carries `--force*` and `-f*`; canon's isForcePush additionally catches `-fu` clusters
// and `git -C … push --force`, which a prefix glob cannot express. Ask is the floor, and settings
// DENIES — so the twin is stronger than the floor, not weaker.
// @twin Bash(rm -rf /*)
// @probed 2026-08-19 hook-disabled: intercepts — prompted · `rm -rf /tmp/<nonexistent>`
// @probed-kit bash-gate v6
// Narrowed from a bare `rm -rf*`, which would have prompted on every scratch-dir cleanup. The
// dangerous shapes are the rooted ones; canon's LETHAL_TARGET is that rule made exact, and it
// additionally catches `\rm`, `(rm`, `/"*"` and `$HOME`, none of which settings can spell.
// @twin Bash(git commit --no-verify*)
// @probed never — NEW with kit v2 on 2026-09-09. CLAUDE.md forbids `--no-verify` by name and
//   until this adoption NOTHING enforced it; the settings twin is added in the same change and
//   has not been observed intercepting with the hook disabled.
// @probed-kit bash-gate v2
// @twin Bash(git merge*)
// @probed never — NEW with kit v2 on 2026-09-09, backing canon's targetsProtectedBranch. The
//   settings pattern is broader than the rule (every merge, not just one into `master`), which
//   is the right asymmetry: ask is the floor and merges are rare here.
// @probed-kit bash-gate v2
// @twin Bash(git clean*)
// @probed never — NEW with kit v2 on 2026-09-09, backing canon's isForceClean. Untracked files
//   are drafts here until they are committed, so the floor is worth an occasional prompt.
// @probed-kit bash-gate v2
// @twin Bash(gh pr merge*)
// @probed never — NEW with kit v6 on 2026-09-11, backing canon's isPrMerge. This project has no PR
//   flow, so the prompt costs nothing, and a merge on GitHub into master IS the deploy. It is
//   exactly as wide as the rule, so it is sized correctly whether or not the hook is live.
// @probed-kit bash-gate v6
// @no-twin isSeamAssignment — settings speaks in prefix-globs over the command string and cannot
//   express "a leading VAR= assignment naming one of this project's hook seams". The pattern that
//   would come closest, `Bash(LT_HOOK_PROBE=*)`, matches only the spelling where that variable is
//   FIRST, so it would read as covered while missing `LT_PRECOMMIT_CMD=x LT_HOOK_PROBE=1 git …`.
//   A twin that covers one spelling of four is worse than none: it reads as a floor and is not one.

// ── Backing THIS PROJECT's rules — each marker sits beside its rule in the regions below ──
// Their `@twin`/`@probed`/`@probed-sha` records live inline there, not here, so the sha binds.
/* KIT:CONFIG /twins */

// THE BRANCH CONFIG IS A MODULE, NOT A REGION HERE, and the reason is the probe.
//
// Until 2026-09-09 `PROTECTED_BRANCH` was declared in a KIT:CONFIG region of THIS file and again
// in one of `bash-gate.probe.mjs`, bound only by a sentence in the probe's region asking a human to
// keep them equal. Set the probe to `master` and leave this at `main` and the probe fails — loud
// and safe. Set THIS to `master` and leave the probe at `main` and the probe PASSES, exercising a
// branch nothing protects while the branch that is protected is never tested. M-KIT-07.
//
// This hook consumes stdin at top level and exports nothing, so the probe cannot import it. A value
// two artefacts must agree on therefore lives in a module they BOTH import — the shape
// `agent-write-scope` reached first (M-KIT-06).
//
// ⚠ PORTING NOTE. This makes the file ESM. If YOUR project has no `"type": "module"`, a `.js` here
// is CommonJS and `import` is a syntax error — Node ≥22.7 reparses it as ESM and prints a
// MODULE_TYPELESS_PACKAGE_JSON warning to stderr on EVERY hook invocation, which is a compensation,
// not a fix, and it is version-dependent. Set `"type": "module"`, or convert this file. Do not
// assume either way. → M-KIT-17.
import { PROTECTED_BRANCH, PROTECTED_REASON } from "./bash-gate.config.mjs";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/* KIT:CONFIG seams — shell variables that, set as a leading assignment, bypass this
 * project's git hooks (a `.githooks` probe seam: `X_HOOK_PROBE=1 git commit …`). An
 * ungated `--no-verify` by another name. Empty means the rule is inert. Setting them
 * through a spawn's `env` object is invisible to this rule by design; only the shell
 * spelling is denied, and the legitimate driver never spells it. */
// `.githooks/{pre-commit,pre-merge-commit,pre-push}` honour `LT_PRECOMMIT_CMD`/`LT_PREPUSH_CMD`
// only when `LT_HOOK_PROBE=1` is set alongside — two variables so neither is a live bypass on
// its own. `scripts/check-git-hooks.mjs` is the legitimate driver and it sets them through
// `spawnSync`'s `env` object (L88, L106, L127, L181), never as a shell assignment, so this rule
// cannot false-deny the gate's own probes. What it stops is the shell spelling:
// `LT_HOOK_PROBE=1 LT_PRECOMMIT_CMD=true git commit` would have made the gate report PASSED
// without running a single check, which is `--no-verify` wearing an env var's clothes.
const SEAM_VARS = ["LT_HOOK_PROBE", "LT_PRECOMMIT_CMD", "LT_PREPUSH_CMD"];
/* KIT:CONFIG /seams */

/* KIT:CONFIG deny — this project's own irreversible acts, beyond the canonical set.
 * Each entry is `[rule, reason]`. A RegExp is tested against ONE SEGMENT's text, so
 * it cannot span `&&`, `;` or `|` into a neighbouring command; a function receives
 * `(tokens, segmentText, command)` for a segment. Prefer `atCommand(tokens, "name")`. */
// PEEL THE PACKAGE RUNNER. Canon's `atCommand` reports the command word, and for
// `npx prisma migrate dev` that word is `npx` — so a rule asking `atCommand(t, "prisma")`
// matches nothing and the gate allows the one command this project most needs denied. It is
// not canon's bug: `npx` is not a WRAPPER in the shell sense (it resolves a binary rather than
// exec'ing its argument), and a project that never uses a runner would not want it treated as
// one. So the peel lives here, where the runner habit does.
// `npm run x` peels two tokens, the rest one. Path-prefixed spellings are matched by suffix,
// so `./node_modules/.bin/prisma` is still prisma.
const RUNNERS = new Set(["npx", "pnpm", "yarn", "bunx"]);
function afterRunner(tokens) {
  const i = commandWordIndex(tokens);
  if (i === -1) return [];
  let t = tokens.slice(i);
  while (t.length > 1 && (RUNNERS.has(t[0]) || (t[0] === "npm" && t[1] === "run"))) {
    t = t[0] === "npm" ? t.slice(2) : t.slice(1);
  }
  return t;
}
const runnerCmd = (tokens, name) => {
  const t = afterRunner(tokens);
  return t.length > 0 && (t[0] === name || t[0].endsWith("/" + name));
};

const PROJECT_DENY = [
  // Prisma's migration engine has never worked against this Supabase instance: DATABASE_URL is
  // the pgbouncer pooler (:6543), and migrate needs a direct connection for its shadow DB and
  // advisory locks. Denied rather than gated, so nobody burns a session rediscovering it.
  // Schema changes go through the Supabase Management API — see .claude/rules/schema-changes.md.
  //
  // THE SCAR THIS RULE CARRIES (2026-08-18, CLAUDE.md §6): as a substring pattern it matched the
  // words "prisma migrate" inside a `git commit` heredoc and denied a commit whose only sin was
  // DESCRIBING the rule. Fixed once for the inline case; `\n` is also a command separator, so the
  // multi-line door stayed open and the same bug came back through it a day later. Canon's
  // segment/heredoc/message masking is that fix generalised — `git` is a HEREDOC_SINK and `-m`
  // values are blanked before any scan — so the rule is expressed at command position and the
  // prose case cannot return.
  // `db pull` and `generate` are the DOCUMENTED RECOVERY and must stay allowed — the reason
  // below tells the reader to run them, so denying them would make the refusal unfollowable.
  // @twin Bash(npx prisma migrate*)
  // @probed 2026-08-19 hook-disabled: intercepts — prompted · `npx prisma migrate --help`
  // @probed-sha 9e9a83
  [
    (t) => {
      if (!runnerCmd(t, "prisma")) return false;
      const a = afterRunner(t).slice(1);
      return a.includes("migrate") || (a.includes("db") && a.includes("push"));
    },
    "prisma migrate/db push does NOT work on this project — apply DDL via the Supabase Management API, then `npx prisma db pull && npx prisma generate` (see .claude/rules/schema-changes.md)",
    { twins: ["Bash(npx prisma migrate*)", "Bash(npx prisma db push*)"] },
  ],

  // DENIED here where canon merely ASKS, which the deny region exists to allow. This project's
  // uncommitted work is routinely a half-finished audit rule or a migration script that exists
  // nowhere else; `--hard` discards it with no undo and no reflog entry to recover it from.
  // @twin Bash(git reset --hard*)
  // @probed 2026-08-19 hook-disabled: intercepts — denied · `git reset --hard HEAD`
  // @probed-sha 3809dd
  [isHardReset, "hard reset is denied — it discards uncommitted work with no undo", { twins: ["Bash(git reset --hard*)"] }],
];
/* KIT:CONFIG /deny */

/* KIT:CONFIG ask — acts that are legitimate but must not happen unattended. Same
 * shape as deny. Severity is yours: a project that wants `git reset --hard` DENIED
 * rather than asked lists it here with its reason and the canon ask never fires. */
const PROJECT_ASK = [
  // EVERY push, not just one to `master`. Canon's branch gate asks about the deployment branch;
  // this project's standing rule is broader and is the reason the gate exists at all: Stéan walks
  // and visually checks the work before it goes out. Claude never pushes on its own initiative.
  // This fires first and its reason is the one the human should read, so the branch gate below
  // only ever speaks for a merge.
  // @twin Bash(git push*)
  // @probed 2026-08-19 hook-disabled: intercepts — prompted · `git push --dry-run`
  // @probed-sha d828f1
  [(t) => atCommand(t, "git") && argsOf(t).includes("push"), "pushing to origin requires approval — the user walks the work first", { twins: ["Bash(git push*)"] }],

  // The Management API is the working path for DDL — but it hits PRODUCTION. Matched on the URL
  // rather than on `curl`, because the URL is what makes it dangerous and the tool carrying it is
  // interchangeable. Bounded quantifier: this runs in front of every Bash call.
  // The twin is coarser than it looks necessary, on purpose: settings.json cannot match a URL
  // mid-command, so the only reliable floor is the tool that carries it. curl is rare here and
  // its two documented uses — this, and triggering a cron by hand with a live CRON_SECRET —
  // both deserve a prompt anyway.
  // @twin Bash(curl*)
  // @probed 2026-08-19 hook-disabled: intercepts — prompted · `curl https://example.com`
  // @probed-sha 5723c1
  [/api\.supabase\.com\/[^\s]{1,200}\/database\/query/, "this runs SQL against production — approve the statement", { twins: ["Bash(curl*)"] }],

  // `atCommand`, not `/\bvercel\b/`. The substring form asked on any command whose text merely
  // CONTAINED the word — a grep for it, a commit message about it, a path with `vercel` in it —
  // which is the shape that trains a user to click through prompts.
  // @twin Bash(vercel*)
  // @probed 2026-08-19 hook-disabled: intercepts — prompted · `vercel --version`
  // @probed-sha 2fcf2e
  [(t) => runnerCmd(t, "vercel"), "deploying requires approval", { twins: ["Bash(vercel*)"] }],

  // .env handling, a two-step decision rather than a table row. Loading a .env is routine —
  // `npx tsx --env-file=.env.local` is the documented way to run scripts here, because ESM hoists
  // imports above `dotenv.config()` and Prisma would otherwise init with no DATABASE_URL.
  // Prompting on that every time would train the user to click through the prompt that matters.
  // What is gated is a command that could PRINT the file's contents. Judged per SEGMENT, so
  // `npx tsx --env-file=.env.local x.ts && cat notes.md` is not read as reading out the .env.
  // @no-twin the two-step .env rule — settings DOES deny `Read(.env*)`, but that is the Read
  //   TOOL, a different channel from a Bash command that prints the file. On the Bash side the
  //   question is "does this command read the file OUT, or merely load it?", and a prefix glob
  //   cannot ask that: `Bash(cat .env*)` would miss `less`, `grep`, `xxd` and every redirection,
  //   while anything broad enough to catch them also catches the documented
  //   `npx tsx --env-file=.env.local`, which runs many times a session. A twin that must be
  //   clicked through several times an hour is a twin that trains the click.
  [
    (t, segText) => {
      if (!/\.env\b/.test(segText)) return false;
      const pipedOut = /\.env[^\s]{0,80}[ \t]*[|>]/.test(segText);
      const loadsEnvOnly = /--env-file[=\s][^\s]{1,200}/.test(segText) && !pipedOut;
      const readsItOut = pipedOut || ["cat", "less", "more", "head", "tail", "grep", "rg", "strings", "xxd", "od", "cp", "mv", "scp"].some((c) => atCommand(t, c));
      return readsItOut && !loadsEnvOnly;
    },
    "reading out a .env file requires approval",
    {
      noTwin:
        "a prefix glob cannot tell a command that reads a .env OUT from one that only loads it: `Bash(cat .env*)` misses less, grep, xxd and every redirection, and anything wider catches the documented `npx tsx --env-file=.env.local`, which runs many times a session. The Read tool's `.env` is denied in settings, which is a different channel",
    },
  ],
];
/* KIT:CONFIG /ask */

/* KIT:CONFIG fallbacks — what stands behind each of CANON's rules if this hook stops running.
 *
 * One entry per canon rule, keyed by its function's name, in one of two shapes:
 *   { twins: ["Bash(git push *main*)", …] } — rules in settings `permissions.deny` or `.ask`
 *   { noTwin: "why a settings rule cannot say it" } — a reason, never a placeholder
 * Canon ships every entry UNFILLED, because which floor a rule deserves is this project's call,
 * and `check-hook-registration` fails an entry until it is answered. It also fails a twin that is
 * not in settings, and a key naming no rule — a canon rename leaves its fallback behind.
 *
 * WRITE A TWIN IN THE SHAPE SETTINGS READS. `:*` is a wildcard only at the END of a pattern; in
 * `Bash(git merge:*main*)` the colon is literal and the rule matches no command. Write
 * `Bash(git merge *main*)`. The space before a `*` is a word boundary: `Bash(git push --force *)`
 * does not match `--force-with-lease`.
 *
 * SIZE A TWIN AS IF IT IS LIVE. Claude Code's permissions page (read 2026-09-11) says a matching ask
 * rule still prompts when this hook returns allow, and a deny still blocks — so a twin wider than
 * its rule fires on commands the rule allows. life-therapy measured an ask NOT prompting under a
 * live hook on 2026-08-18. Until the two agree, a twin that would be wrong while the hook is alive
 * is a `noTwin`, with that as its reason. */
// ANSWERED 2026-09-11 from the settings this project already held, plus one ask added for gh pr merge.
// Every twin below is one of the patterns the twins region above records, so the reasoning there
// holds: ASK IS THE FLOOR, and a twin that prompts more widely than its rule is the accepted cost.
// Sized as if live, none is WRONG while the hook runs. The widest are `git merge*`, `git clean*`
// and `git push*`: a prompt on a merge, a dry-run clean or a push the hook also asks on. None
// blocks a command that the hook allows. The two DENY twins, the force-push ones and
// `git reset --hard*`, deny only what the hook denies too. Canon asked whether an ask prompts under a
// hook that allowed. It does, measured 2026-09-11 (the twins region above), so each twin is live and
// sized as the paragraph above says.
//
// The floor is PARTIAL where a prefix glob cannot spell the rule, and it says so rather than
// reading as cover. Every git twin starts `git <verb>`, so `git -C x push --force` or
// `git -c k=v commit --no-verify` meets none of them. `git revert --no-verify` and
// `git cherry-pick --no-verify` have no glob here either. The same goes for `gh -R o/r pr merge`.
const CANON_FALLBACKS = {
  isDestructiveRm: { twins: ["Bash(rm -rf /*)", "Bash(rm -rf ~*)"] },
  isForcePush: { twins: ["Bash(git push --force*)", "Bash(git push -f*)"] },
  isForceRefspec: { twins: ["Bash(git push*)"] },
  isNoVerify: { twins: ["Bash(git commit --no-verify*)", "Bash(git push --no-verify*)"] },
  isSeamAssignment: {
    noTwin:
      "a prefix glob matches the FIRST word, and a seam assignment may name any of three variables in any order — `Bash(LT_HOOK_PROBE=*)` would miss `LT_PRECOMMIT_CMD=x LT_HOOK_PROBE=1 git …` and read as a floor that is not one",
  },
  targetsProtectedBranch: { twins: ["Bash(git merge*)", "Bash(git push*)"] },
  isPrMerge: { twins: ["Bash(gh pr merge*)"] },
  isHardReset: { twins: ["Bash(git reset --hard*)"] },
  isForceClean: { twins: ["Bash(git clean*)"] },
};
/* KIT:CONFIG /fallbacks */

// ── Canon machinery. Every rule is a token test at command position in one segment. ──

/**
 * Strip the shell punctuation that carries no meaning for these rules, so one token
 * compares as one word: `/"*"` and `'/'*` are both `/*` to the shell, `(rm` hides a
 * command in a subshell, `\rm` is the standard alias-bypass idiom. Quotes come out
 * ANYWHERE, because mid-token is exactly where they were used to hide.
 * A character loop, not a regex: an anchored greedy class backtracks across a run of
 * the same character, and this runs in front of every Bash call.
 */
function normToken(t) {
  const s = t.replace(/["'`]/g, "");
  let i = 0;
  let j = s.length;
  while (i < j && "\\({[".includes(s[i])) i++;
  while (j > i && ")}]".includes(s[j - 1])) j--;
  return s.slice(i, j);
}

/**
 * Commands whose stdin is DATA, never code. A heredoc feeding one of these is prose
 * and its body is masked before any rule runs — so `git commit -F - <<'MSG'` may
 * discuss `rm -rf /` without tripping the gate, which is the workaround this file's
 * v1 advertised and could not honour. An UNLISTED receiver keeps its body (`bash
 * <<EOF`, `python -`, `psql`, `ssh host`): unknown fails toward deny, so a heredoc
 * is never a universal envelope. Extend the list, do not invert it.
 */
const HEREDOC_SINKS = new Set([
  "cat", "tee", "git", "gh", "grep", "egrep", "fgrep", "rg", "sed", "awk", "head", "tail",
  "wc", "sort", "uniq", "cut", "tr", "diff", "less", "more", "jq", "yq", "base64", "md5sum",
  "sha256sum", "curl", "wget", "dd", "od", "xxd", "hexdump", "column", "fold", "paste",
]);

const WRAPPERS = new Set(["sudo", "env", "command", "exec", "nohup", "nice", "time", "builtin"]);

/** Index of the command word in a segment: past leading `VAR=x` assignments and wrappers. */
function commandWordIndex(tokens) {
  let i = 0;
  while (i < tokens.length && (WRAPPERS.has(tokens[i]) || /^[A-Za-z_]\w*=/.test(tokens[i]))) i++;
  return i < tokens.length ? i : -1;
}

/** Is `name` this segment's command (as `name`, `/usr/bin/name`, `\name`, or after `sudo`)? */
function atCommand(tokens, name) {
  const i = commandWordIndex(tokens);
  if (i === -1) return false;
  const t = tokens[i];
  return t === name || t.endsWith("/" + name);
}

/** Everything after the command word — the arguments, as tokens. */
function argsOf(tokens) {
  const i = commandWordIndex(tokens);
  return i === -1 ? [] : tokens.slice(i + 1);
}

/**
 * Mask heredoc BODIES whose receiver is a sink. Opener `<<-?['"]?ID['"]?`; terminator
 * is the bare ID on its own line. No terminator → nothing masked (keep the body,
 * fail toward deny). The receiver is the command word of the last segment on the
 * opener's line before `<<`.
 *
 * ONE PASS. Bare-identifier lines are indexed first, then each opener binary-searches
 * for its terminator — a scan-to-end per opener measured QUADRATIC (20k unterminated
 * openers: 4 s), and a hook that can be made to hang has failed at the one job it has.
 */
function maskSinkHeredocs(command) {
  const lines = command.split("\n");
  const bare = new Map(); // ID → ascending line numbers where the line is exactly that ID
  for (let j = 0; j < lines.length; j++) {
    const m = /^[ \t]*([A-Za-z_]\w*)[ \t]*$/.exec(lines[j]);
    if (m) (bare.get(m[1]) ?? bare.set(m[1], []).get(m[1])).push(j);
  }
  const firstAfter = (list, i) => {
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid] > i) hi = mid;
      else lo = mid + 1;
    }
    return lo < list.length ? list[lo] : -1;
  };
  const out = [];
  // Emits line i, and a sink heredoc's masked body if one opens there. Returns the last line
  // consumed — the terminator, or i itself — so the loop never reassigns its own counter.
  const consume = (i) => {
    const line = lines[i];
    out.push(line);
    const m = /<<-?\s*(['"]?)([A-Za-z_]\w*)\1/.exec(line);
    if (!m) return i;
    const before = line.slice(0, m.index);
    const seg = before.split(/[;&|]+/).pop() ?? "";
    const tokens = seg.split(/\s+/).map(normToken).filter(Boolean);
    const cw = commandWordIndex(tokens);
    const receiver = cw === -1 ? "" : tokens[cw].replace(/^.*\//, "");
    if (!HEREDOC_SINKS.has(receiver)) return i;
    const j = firstAfter(bare.get(m[2]) ?? [], i);
    if (j === -1) return i; // unterminated: keep the body
    for (let k = i + 1; k < j; k++) out.push("");
    out.push(lines[j]);
    return j;
  };
  let i = 0;
  while (i < lines.length) i = consume(i) + 1;
  return out.join("\n");
}

/**
 * A command string as SEGMENTS of normalised tokens — one per shell command. Line
 * continuations are joined first, or `\`+newline tears a command in half at exactly
 * the point an attacker would choose. `$(` and backticks open a segment too, so a
 * substitution is a command position and not a hiding place.
 */
function segments(command) {
  return maskSinkHeredocs(command)
    .replace(/\\\r?\n/g, " ")
    .split(/[;&|\n]+|\$\(|`/)
    .map((seg) => ({ text: seg.trim(), tokens: seg.split(/\s+/).map(normToken).filter(Boolean) }))
    .filter((s) => s.tokens.length > 0);
}

/**
 * Blank the TEXT of a `-m`/`--message` value, quotes left in place, before scanning
 * for FLAGS. The message is git's argument, not a switch — denying `git commit -m
 * "we ban --no-verify"` means the gate forbids writing down the rule it enforces.
 * NOT "strip quotes": `git commit "--no-verify"` IS the flag once the shell strips
 * the quotes, and `normToken` treats it so. Only the value of `-m` is inert.
 */
function maskMessageText(command) {
  const out = command.split("");
  const isSpace = (c) => c === " " || c === "\t" || c === "\r" || c === "\n";
  let i = 0;
  while (i < command.length) {
    let flagLen = 0;
    if (command.startsWith("--message", i)) flagLen = 9;
    else if (command.startsWith("-m", i)) flagLen = 2;
    const after = command[i + flagLen];
    const standalone = flagLen > 0 && (i === 0 || isSpace(command[i - 1])) && (after === undefined || isSpace(after));
    if (!standalone) {
      i++;
      continue;
    }
    let k = i + flagLen;
    while (k < command.length && isSpace(command[k])) k++;
    const quote = command[k];
    if (quote !== '"' && quote !== "'") {
      i = k > i ? k : i + 1;
      continue;
    }
    let end = k + 1;
    while (end < command.length && command[end] !== quote) {
      if (command[end] === "\\") end++;
      end++;
    }
    for (let p = k + 1; p < Math.min(end, command.length); p++) out[p] = " ";
    i = end + 1;
  }
  return out.join("");
}

// A root, a bare home, a drive root, or any of those followed only by more `/` and `*`.
// `/tmp/scratch` and `~/projects` fail because a NAMED segment follows — the two cases
// that separate a gate from a wall.
const LETHAL_TARGET = /^(?:[/~][/*]*|[A-Za-z]:[/\\]?[/*]*|\$\{?HOME\}?[/*]*)$/;
const FORCE_LONG = /^--force(?:=.*)?$/;
// Everything before the FIRST `f` is a letter other than `f`, so there is one way to match and
// nothing to backtrack over. `[A-Za-z]*f` accepted the same strings in quadratic time.
const SHORT_CLUSTER_WITH_F = /^-[A-Za-eg-z]*f[A-Za-z]*$/;

function isDestructiveRm(tokens) {
  return atCommand(tokens, "rm") && argsOf(tokens).some((t) => LETHAL_TARGET.test(t));
}

/** `git … push … --force|-f|-xf` — `--force-with-lease` and `--force-if-includes` are the SAFE forms and pass. */
function isForcePush(tokens) {
  if (!atCommand(tokens, "git")) return false;
  const args = argsOf(tokens);
  if (!args.includes("push")) return false;
  return args.some((t) => FORCE_LONG.test(t) || SHORT_CLUSTER_WITH_F.test(t));
}

/** `--no-verify` on the hooked verbs, and `-n` only where `-n` MEANS it (commit, push). */
function isNoVerify(tokens) {
  if (!atCommand(tokens, "git")) return false;
  const args = argsOf(tokens);
  const verb = args.find((t) => ["commit", "push", "merge", "revert", "cherry-pick"].includes(t));
  if (!verb) return false;
  if (args.includes("--no-verify")) return true;
  return ["commit", "push"].includes(verb) && args.includes("-n");
}

/** A leading `SEAM_VAR=…` assignment — the only spelling of the seam the Bash tool can reach. */
function isSeamAssignment(tokens) {
  if (SEAM_VARS.length === 0) return false;
  let i = 0;
  if (tokens[0] === "export" || tokens[0] === "env") i = 1;
  for (; i < tokens.length; i++) {
    const eq = tokens[i].indexOf("=");
    if (eq <= 0) break;
    if (SEAM_VARS.includes(tokens[i].slice(0, eq))) return true;
  }
  return false;
}

// ── WHICH BRANCH A GIT ACT LANDS ON, WHEN THE COMMAND DOES NOT SAY (v5, yoros CF-3 and CF-5) ──
//
// v4 asked only when a merge or push NAMED the protected branch. Measured by yoros on the real hook:
//
//   git checkout main && git merge rebuild && git push     allow   ← the ordinary deploy sequence
//   git push  ·  git push origin HEAD  ·  git merge rebuild  allow   (while main is checked out)
//   git push origin rebuild:refs/heads/main                  allow
//   git push --all origin  ·  git push --mirror origin       allow
//   git push origin +main                                    allow   ← a force-push to the deploy branch
//
// L-14's general form, in canon's own hook: a gate that matches how a target APPEARS misses it when
// it is supplied BY REFERENCE. So the target is resolved: the branch a checkout or switch EARLIER IN
// THE SAME COMMAND moved to, else the one `.git/HEAD` names, else UNKNOWN, which asks. What follows is
// yoros's stopgap (`bash-gate.refs.mjs`, mutation-tested 6 of 6), lifted with its reasoning.
//
// ⚠ `.git/HEAD` IS READ ONLY WHEN `CLAUDE_PROJECT_DIR` IS SET, and that is sound rather than
// convenient. Every project registers this hook as `node "$CLAUDE_PROJECT_DIR/.claude/hooks/…"`, so
// a hook running under the harness has it. Unset means a probe or a hand run, and reading the
// probe's own checkout there would make its bare-push cases pass or fail by which branch is out.
// Unset is NOT_READ, which asserts nothing; set and unreadable is UNKNOWN, which asks.
//
// `gh pr merge` merges into the PR's base, which lives on the server and not in the command, so it is
// UNKNOWN and asks, whatever the base turns out to be.
//
// NOT COVERED, stated so it is not mistaken for cover: a push through an alias or a script, and
// `git rebase`/`reset` onto the protected branch, which move the local branch and deploy nothing
// until a push this does see.

/** Outside the harness: no HEAD was read, and nothing is known either way. */
const NOT_READ = undefined;
/** Inside it, and still unknown: detached, unreadable, or another repository. This ASKS. */
const UNKNOWN = null;

/** The branch `.git/HEAD` names, following a `.git` FILE (a worktree or submodule) to its gitdir. */
function readHeadBranch(root) {
  if (!root) return NOT_READ;
  try {
    let gitDir = join(root, ".git");
    if (statSync(gitDir).isFile()) {
      const line = readFileSync(gitDir, "utf8").split(/\r?\n/).find((l) => l.startsWith("gitdir:"));
      if (!line) return UNKNOWN;
      gitDir = resolve(root, line.slice("gitdir:".length).trim());
    }
    const head = readFileSync(join(gitDir, "HEAD"), "utf8").trim();
    const REF = "ref: refs/heads/";
    return head.startsWith(REF) ? head.slice(REF.length).trim() || UNKNOWN : UNKNOWN;
  } catch {
    return UNKNOWN;
  }
}

let headMemo = null;
function headBranch() {
  if (headMemo === null) headMemo = { v: readHeadBranch(process.env.CLAUDE_PROJECT_DIR || null) };
  return headMemo.v;
}

/**
 * Drop shell redirections, which the tokens keep: `git push > "$LOG" 2>&1` is a probe case, and read
 * as arguments it would make `>` a remote and `$LOG` a refspec, which is an explicit destination and
 * allows. `>` / `2>>` / `&>` take the next token; `>out` / `2>/dev/null` carry theirs.
 */
function dropRedirections(args) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    const t = args[i];
    if (/^(?:\d*|&)[<>]{1,2}&?$/.test(t)) {
      i++;
      continue;
    }
    if (/^(?:\d*|&)[<>]/.test(t)) continue;
    out.push(t);
  }
  return out;
}

/** git's global options that take a value as the NEXT token, and those that point it elsewhere. */
const GLOBAL_WITH_VALUE = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"]);
const ELSEWHERE = /^(?:-C|--git-dir(?:=.*)?|--work-tree(?:=.*)?)$/;

/** `{ verb, rest, elsewhere }` for a git segment's arguments (the tokens after `git`). */
function gitVerb(args) {
  const a = dropRedirections(args);
  let elsewhere = false;
  let i = 0;
  while (i < a.length && a[i].startsWith("-")) {
    if (ELSEWHERE.test(a[i])) elsewhere = true;
    i += GLOBAL_WITH_VALUE.has(a[i]) ? 2 : 1;
  }
  return { verb: a[i] ?? "", rest: a.slice(i + 1), elsewhere };
}

/** A token that names a PATH rather than a branch: a file checkout leaves the branch alone. */
const looksLikePath = (t) => t.includes(".") || t.includes("\\") || t.startsWith("/");

/**
 * The branch after a `git checkout` / `git switch` segment, given the one before it. A path checkout
 * (`--`, or a file) leaves it alone. `-` and `--detach` make it UNKNOWN: the previous branch is not
 * in the command.
 */
function branchAfter(args, current) {
  const { verb, rest, elsewhere } = gitVerb(args);
  if (elsewhere || (verb !== "checkout" && verb !== "switch")) return current;
  if (rest.includes("--")) return current;
  const create = verb === "checkout" ? ["-b", "-B", "--orphan"] : ["-c", "-C", "--create", "--force-create", "--orphan"];
  for (let i = 0; i < rest.length; i++) {
    if (create.includes(rest[i])) return rest[i + 1] ?? UNKNOWN;
    if (rest[i] === "--detach" || (rest[i] === "-d" && verb === "switch")) return UNKNOWN;
  }
  const positional = rest.filter((t) => !t.startsWith("-") || t === "-");
  if (positional.length === 0) return current;
  if (positional[0] === "-") return UNKNOWN;
  // `--track origin/main` creates and checks out a LOCAL `main`, so the remote prefix comes off.
  const tracks = rest.some((t) => t === "-t" || t === "--track" || t.startsWith("--track="));
  if (tracks && positional.length === 1 && positional[0].includes("/")) return positional[0].slice(positional[0].indexOf("/") + 1);
  if (positional.length > 1 || looksLikePath(positional[0])) return current;
  return positional[0];
}

/** A path for comparison: forward slashes, `/c/` as `c:/`, lower case, no trailing slash. */
function normPath(p) {
  let s = p.replace(/\\/g, "/").replace(/^\/([a-z])\//i, "$1:/").toLowerCase();
  while (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s;
}

/** The branch after a `cd` / `pushd`: the same one if it stays in this repository, else UNKNOWN. */
function branchAfterCd(target, current, root) {
  if (target === undefined || target === "-" || target === "~" || target.startsWith("~/")) return UNKNOWN;
  const absolute = /^(?:\/|[A-Za-z]:[\\/])/.test(target);
  if (!absolute) return target.split(/[\\/]/).includes("..") ? UNKNOWN : current;
  if (!root) return UNKNOWN;
  const t = normPath(target);
  const r = normPath(root);
  return t === r || t.startsWith(r + "/") ? current : UNKNOWN;
}

/** `git push` options that take a value as the NEXT token; those that push every branch. */
const PUSH_WITH_VALUE = new Set(["-o", "--push-option", "--repo", "--receive-pack", "--exec"]);
const PUSH_ALL = new Set(["--all", "--mirror", "--branches"]);
/** The current-branch aliases a refspec may use. */
const SELF_REF = new Set(["HEAD", "@"]);

/**
 * What a `git push`'s arguments land on: `{ all, current, branches, forced }`. `all` is --all /
 * --mirror. `current` is a push of the checked-out branch (no refspec, or `HEAD`). `branches` are the
 * destination BRANCH names, with `+` and `refs/heads/` taken off. `forced` is any `+refspec`.
 */
function pushTargets(rest) {
  const flags = [];
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t.startsWith("-")) {
      flags.push(t);
      if (PUSH_WITH_VALUE.has(t)) i++;
    } else positional.push(t);
  }
  const refspecs = positional.slice(1);
  const all = flags.some((f) => PUSH_ALL.has(f));
  const tagsOnly = refspecs.length === 0 && flags.includes("--tags");
  const out = { all, current: false, branches: [], forced: false };
  if (refspecs.length === 0) {
    out.current = !all && !tagsOnly;
    return out;
  }
  for (const spec of refspecs) {
    if (spec.startsWith("+")) out.forced = true;
    const s = spec.startsWith("+") ? spec.slice(1) : spec;
    const colon = s.lastIndexOf(":");
    const src = colon === -1 ? s : s.slice(0, colon);
    const dst = colon === -1 ? s : s.slice(colon + 1) || src;
    if (SELF_REF.has(dst) || (colon === -1 && SELF_REF.has(src))) out.current = true;
    else out.branches.push(dst.startsWith("refs/heads/") ? dst.slice("refs/heads/".length) : dst);
  }
  return out;
}

/**
 * Does segment `index` merge, pull or push into the protected branch? `plan` is every segment as
 * `{ kind: "git" | "cd" | "popd" | "other", args }`; the segments before `index` say which branch is
 * checked out when this one runs.
 */
function reachesProtected(plan, index, { protectedBranch, head, root }) {
  let current = head;
  for (let i = 0; i < index; i++) {
    const s = plan[i];
    if (s.kind === "git") current = branchAfter(s.args, current);
    else if (s.kind === "cd") current = branchAfterCd(s.args.find((t) => !t.startsWith("-")), current, root);
    else if (s.kind === "popd") current = UNKNOWN;
  }
  const s = plan[index];
  if (s.kind !== "git") return false;
  const { verb, rest, elsewhere } = gitVerb(s.args);
  const here = elsewhere ? UNKNOWN : current;
  // NOT_READ (outside the harness) is not UNKNOWN: nothing was read, so nothing is asserted.
  const onProtected = here === protectedBranch || here === UNKNOWN;
  if (verb === "merge") {
    if (rest.some((t) => ["--abort", "--quit", "--continue"].includes(t))) return false;
    return onProtected;
  }
  if (verb === "pull") {
    // A bare pull syncs the branch with its own upstream. Naming ANOTHER branch merges it in.
    const positional = rest.filter((t) => !t.startsWith("-"));
    const merged = positional.slice(1).map((t) => (t.startsWith("+") ? t.slice(1) : t).split(":")[0]);
    return merged.some((b) => b !== here) && onProtected;
  }
  if (verb === "push") {
    const t = pushTargets(rest);
    if (t.all) return true;
    if (t.branches.includes(protectedBranch)) return true;
    return t.current && onProtected;
  }
  return false;
}

const planOf = (segs) =>
  segs.map((s) => ({
    kind: atCommand(s.tokens, "git") ? "git"
      : atCommand(s.tokens, "cd") || atCommand(s.tokens, "pushd") ? "cd"
      : atCommand(s.tokens, "popd") ? "popd" : "other",
    args: argsOf(s.tokens),
  }));

function targetsProtectedBranch(tokens, _text, _command, ctx) {
  if (!atCommand(tokens, "git")) return false;
  const args = argsOf(tokens);
  const b = PROTECTED_BRANCH;
  // NAMED: v4's test, kept whole. Every command it asked on still asks.
  if ((args.includes("push") || args.includes("merge")) &&
    args.some((t) => t === b || t === `origin/${b}` || t === `refs/heads/${b}` || t.endsWith(`:${b}`))) return true;
  // BY REFERENCE: everything else that lands there.
  if (!ctx) return false;
  return reachesProtected(ctx.plan, ctx.index, { protectedBranch: b, head: headBranch(), root: process.env.CLAUDE_PROJECT_DIR || null });
}

/**
 * `git push origin +main`: a `+` on a refspec IS `--force` for that ref. v4 read it as a branch name
 * that did not equal `main`, and allowed it (yoros CF-5). Denied with or without a lease flag beside
 * it: what `+` does alongside `--force-with-lease` is not something this file should have to know.
 */
function isForceRefspec(tokens) {
  if (!atCommand(tokens, "git")) return false;
  const { verb, rest } = gitVerb(argsOf(tokens));
  return verb === "push" && pushTargets(rest).forced;
}

/** `gh pr merge`: the base branch is on the server, so the command cannot say where this lands. */
function isPrMerge(tokens) {
  if (!atCommand(tokens, "gh")) return false;
  const args = argsOf(tokens);
  const i = args.indexOf("pr");
  return i !== -1 && args[i + 1] === "merge";
}

function isHardReset(tokens) {
  return atCommand(tokens, "git") && argsOf(tokens).includes("reset") && argsOf(tokens).includes("--hard");
}

function isForceClean(tokens) {
  if (!atCommand(tokens, "git")) return false;
  const args = argsOf(tokens);
  return args.includes("clean") && args.some((t) => t === "--force" || SHORT_CLUSTER_WITH_F.test(t));
}

const CANON_DENY = [
  [isDestructiveRm, "rm aimed at a filesystem root or home directory"],
  [isForcePush, "force-push without --force-with-lease"],
  [isForceRefspec, "a +refspec force-pushes that ref — push without the +, or use --force-with-lease"],
  [isNoVerify, "--no-verify (or -n on commit/push) skips the project's own gate"],
  [isSeamAssignment, "sets a hook probe seam — the gate would report PASSED without running"],
];
const CANON_ASK = [
  [targetsProtectedBranch, PROTECTED_REASON],
  [isPrMerge, "gh pr merge merges into the PR's base branch, which is on the server and not in this command — if it is the protected branch, this is the deploy"],
  [isHardReset, "git reset --hard discards uncommitted work with no undo"],
  [isForceClean, "git clean -f deletes untracked files permanently — drafts are untracked until committed"],
];

// A function rule also receives `{ plan, index }`: every segment's kind and arguments, and which one
// this is. Only the protected-branch rule reads it — which branch a segment lands on is decided by
// the segments before it — and a project rule may ignore it.
const fires = (rule, seg, command, ctx) =>
  typeof rule === "function" ? rule(seg.tokens, seg.text, command, ctx) : rule.test(seg.text);

function decide(command) {
  // Flag scans run on the message-masked text; the rm rule on the unmasked text, so
  // `-m "rm -rf /"` is prose either way (rm is not at command position there).
  const segs = segments(maskMessageText(command));
  const plan = planOf(segs);
  const hit = (rule) => segs.some((s, index) => fires(rule, s, command, { plan, index }));
  for (const [rule, why] of [...CANON_DENY, ...PROJECT_DENY]) {
    if (hit(rule)) return ["deny", why];
  }
  for (const [rule, why] of [...CANON_ASK, ...PROJECT_ASK]) {
    if (hit(rule)) return ["ask", why];
  }
  return ["allow", "allowed — no gate matched"];
}

// ── v6: WHAT STANDS BEHIND EACH RULE IF THIS HOOK STOPS RUNNING (yoros CF-4) ──
//
// L-16: a rule held at the hook layer alone needs a fallback, reconciled as a set difference. Until
// v6 the fallback was declared per FILE — one `@twin` line anywhere passed — so the difference taken
// was twins against settings, and rules against twins was never taken: two twins backed one rule of
// nine and the check was green. The fallback now sits ON the rule, and this lists every rule with
// its fallback, so a count can see a rule that has none. Canon's rules take theirs from the
// fallbacks region by function name; a project's carry theirs as the third element of the entry.
//
// `node bash-gate.js --fallbacks` prints the list as JSON and reads no stdin. Claude Code never
// passes an argument, so a gating run cannot reach it. `inert` marks the one rule that cannot fire:
// the seam rule, with no seams configured, needs no floor until it has something to hold.
function inventory() {
  const canonRule = (severity) => ([rule, reason]) => ({
    severity,
    owner: "canon",
    rule: rule.name,
    reason,
    fallback: Object.hasOwn(CANON_FALLBACKS, rule.name) ? CANON_FALLBACKS[rule.name] : null,
    inert: rule === isSeamAssignment && SEAM_VARS.length === 0,
  });
  const projectRule = (severity, table) => ([, reason, fallback], i) => ({
    severity,
    owner: "project",
    rule: `${table}[${i}]`,
    reason,
    fallback: fallback ?? null,
    inert: false,
  });
  const names = new Set([...CANON_DENY, ...CANON_ASK].map(([rule]) => rule.name));
  return {
    rules: [
      ...CANON_DENY.map(canonRule("deny")),
      ...PROJECT_DENY.map(projectRule("deny", "PROJECT_DENY")),
      ...CANON_ASK.map(canonRule("ask")),
      ...PROJECT_ASK.map(projectRule("ask", "PROJECT_ASK")),
    ],
    strays: Object.keys(CANON_FALLBACKS).filter((k) => !names.has(k)),
  };
}

/** The gating run: one hook payload on stdin, one decision on stdout. */
function gate() {
  const chunks = [];
  process.stdin.on("data", (d) => chunks.push(d));
  process.stdin.on("end", () => {
    let decision = "allow";
    let reason = "bash-gate: allowed — no gate matched";
    try {
      // Buffers, not string concatenation: a multibyte character split across chunks
      // would corrupt the JSON. A leading BOM (Windows) is stripped — written as the
      // escape so it survives a diff, an editor and a control-byte assertion.
      const raw = Buffer.concat(chunks).toString("utf8").replace(/^\uFEFF/, "");
      const input = JSON.parse(raw);
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("hook input is not an object");
      }
      const command = String(input.tool_input?.command ?? "");
      const [d, why] = decide(command);
      decision = d;
      reason = "bash-gate: " + why;
    } catch {
      decision = "ask";
      reason = "bash-gate: could not parse hook input — failing to a prompt, not to silence";
    }
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: reason },
      }),
    );
  });
}

if (process.argv.includes("--fallbacks")) {
  process.stdout.write(JSON.stringify(inventory()));
} else {
  gate();
}
