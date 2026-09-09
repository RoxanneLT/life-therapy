/**
 * bash-gate.js — PreToolUse gate for Bash. KIT FILE, install at `.claude/hooks/`.
 *
 * @kit bash-gate v2 — tracked OUTSIDE its `KIT:CONFIG` regions. Those regions are yours;
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
 * remove all three at once.
 *
 * v2 (2026-09-08) is the harvest of four field copies. Measured before it:
 * canon ALLOWED `git push -f`, `\rm -rf /`, `(rm -rf /*)`, `rm -rf /"*"` and
 * `git commit --no-verify`; false-DENIED `rm -rf .next && du -sh /`; and ASKED
 * on `git fetch origin main && git push origin feature/x` with a reason that
 * named the wrong segment. Each is a probe case now.
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

/* KIT:CONFIG twins — the settings.json `ask` rules that back the ASK gates below.
 * `check-hook-registration.mjs` reconciles these against settings, so every @twin
 * here must exist there and vice versa. Declare a @no-twin with its reason instead
 * where a coarse settings pattern would be WRONG rather than merely redundant. */

// A TWIN IS DORMANT BY DESIGN, and this project measured that rather than assuming it.
// MEASURED 2026-08-18: a hook "allow" does NOT leave settings.json free to intervene.
// `Bash(curl*)` sits in permissions.ask, and a bare curl — which this hook allows, since
// its rule only matches the Management API URL — ran with NO PROMPT AT ALL. The hook
// short-circuits the permission system entirely. These are not belt-and-braces while the
// hook is alive.
//
// That does not break the twin design; it explains it. A twin matters in exactly one
// scenario: this hook dead, its script path broken, its failure reported as a non-blocking
// status nobody reads. Then settings is all there is, and every rule held here alone
// degrades WITHOUT FAILING — deny silently becomes ask, ask silently becomes allow.
//
// Consequence for testing: a twin cannot be probed while the hook is alive, because the
// hook answers first. Verifying one means disabling this hook and re-running the command —
// which is also a faithful rehearsal of the only situation the twin covers. That is what
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

// ── Backing CANON's rules (CANON_DENY / CANON_ASK — not this project's bytes) ──
// @twin Bash(git push --force*)
// @probed 2026-08-19 hook-disabled: intercepts — denied · `git push --force --dry-run`
// @probed-kit bash-gate v2
// Settings carries `--force*` and `-f*`; canon's isForcePush additionally catches `-fu` clusters
// and `git -C … push --force`, which a prefix glob cannot express. Ask is the floor, and settings
// DENIES — so the twin is stronger than the floor, not weaker.
// @twin Bash(rm -rf /*)
// @probed 2026-08-19 hook-disabled: intercepts — prompted · `rm -rf /tmp/<nonexistent>`
// @probed-kit bash-gate v2
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
// @no-twin isSeamAssignment — settings speaks in prefix-globs over the command string and cannot
//   express "a leading VAR= assignment naming one of this project's hook seams". The pattern that
//   would come closest, `Bash(LT_HOOK_PROBE=*)`, matches only the spelling where that variable is
//   FIRST, so it would read as covered while missing `LT_PRECOMMIT_CMD=x LT_HOOK_PROBE=1 git …`.
//   A twin that covers one spelling of four is worse than none: it reads as a floor and is not one.

// ── Backing THIS PROJECT's rules — each marker sits beside its rule in the regions below ──
// Their `@twin`/`@probed`/`@probed-sha` records live inline there, not here, so the sha binds.
/* KIT:CONFIG /twins */

/* KIT:CONFIG branch — the ASK gate every project needs: whatever act constitutes
 * the DEPLOYMENT. Name the protected branch and say, in the reason, what is on the
 * other side of it — "this targets main" teaches nothing; "there is no staging step
 * between this and the live site" stops the hand. */
const PROTECTED_BRANCH = "master";
const PROTECTED_REASON =
  "Vercel builds from `master` and there is no separate deploy step, so this IS the deploy — " +
  "it reaches clients' booking pages and their money without anything in between";
/* KIT:CONFIG /branch */

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
  // @probed-sha 8e4a09
  [
    (t) => {
      if (!runnerCmd(t, "prisma")) return false;
      const a = afterRunner(t).slice(1);
      return a.includes("migrate") || (a.includes("db") && a.includes("push"));
    },
    "prisma migrate/db push does NOT work on this project — apply DDL via the Supabase Management API, then `npx prisma db pull && npx prisma generate` (see .claude/rules/schema-changes.md)",
  ],

  // DENIED here where canon merely ASKS, which the deny region exists to allow. This project's
  // uncommitted work is routinely a half-finished audit rule or a migration script that exists
  // nowhere else; `--hard` discards it with no undo and no reflog entry to recover it from.
  // @twin Bash(git reset --hard*)
  // @probed 2026-08-19 hook-disabled: intercepts — denied · `git reset --hard HEAD`
  // @probed-sha 82887d
  [isHardReset, "hard reset is denied — it discards uncommitted work with no undo"],
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
  // @probed-sha 202f6e
  [(t) => atCommand(t, "git") && argsOf(t).includes("push"), "pushing to origin requires approval — the user walks the work first"],

  // The Management API is the working path for DDL — but it hits PRODUCTION. Matched on the URL
  // rather than on `curl`, because the URL is what makes it dangerous and the tool carrying it is
  // interchangeable. Bounded quantifier: this runs in front of every Bash call.
  // The twin is coarser than it looks necessary, on purpose: settings.json cannot match a URL
  // mid-command, so the only reliable floor is the tool that carries it. curl is rare here and
  // its two documented uses — this, and triggering a cron by hand with a live CRON_SECRET —
  // both deserve a prompt anyway.
  // @twin Bash(curl*)
  // @probed 2026-08-19 hook-disabled: intercepts — prompted · `curl https://example.com`
  // @probed-sha f2847b
  [/api\.supabase\.com\/[^\s]{1,200}\/database\/query/, "this runs SQL against production — approve the statement"],

  // `atCommand`, not `/\bvercel\b/`. The substring form asked on any command whose text merely
  // CONTAINED the word — a grep for it, a commit message about it, a path with `vercel` in it —
  // which is the shape that trains a user to click through prompts.
  // @twin Bash(vercel*)
  // @probed 2026-08-19 hook-disabled: intercepts — prompted · `vercel --version`
  // @probed-sha d0abc5
  [(t) => runnerCmd(t, "vercel"), "deploying requires approval"],

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
  ],
];
/* KIT:CONFIG /ask */

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
  while (i < tokens.length && (WRAPPERS.has(tokens[i]) || /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i]))) i++;
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
    const m = /^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*$/.exec(lines[j]);
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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    const m = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(line);
    if (!m) continue;
    const before = line.slice(0, m.index);
    const seg = before.split(/[;&|]+/).pop() ?? "";
    const tokens = seg.split(/\s+/).map(normToken).filter(Boolean);
    const cw = commandWordIndex(tokens);
    const receiver = cw === -1 ? "" : tokens[cw].replace(/^.*\//, "");
    if (!HEREDOC_SINKS.has(receiver)) continue;
    const j = firstAfter(bare.get(m[2]) ?? [], i);
    if (j === -1) continue; // unterminated: keep the body
    for (let k = i + 1; k < j; k++) out.push("");
    out.push(lines[j]);
    i = j;
  }
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
const SHORT_CLUSTER_WITH_F = /^-[A-Za-z]*f[A-Za-z]*$/;

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

function targetsProtectedBranch(tokens) {
  if (!atCommand(tokens, "git")) return false;
  const args = argsOf(tokens);
  if (!args.includes("push") && !args.includes("merge")) return false;
  const b = PROTECTED_BRANCH;
  return args.some((t) => t === b || t === `origin/${b}` || t === `refs/heads/${b}` || t.endsWith(`:${b}`));
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
  [isNoVerify, "--no-verify (or -n on commit/push) skips the project's own gate"],
  [isSeamAssignment, "sets a hook probe seam — the gate would report PASSED without running"],
];
const CANON_ASK = [
  [targetsProtectedBranch, PROTECTED_REASON],
  [isHardReset, "git reset --hard discards uncommitted work with no undo"],
  [isForceClean, "git clean -f deletes untracked files permanently — drafts are untracked until committed"],
];

const fires = (rule, seg, command) =>
  typeof rule === "function" ? rule(seg.tokens, seg.text, command) : rule.test(seg.text);

function decide(command) {
  // Flag scans run on the message-masked text; the rm rule on the unmasked text, so
  // `-m "rm -rf /"` is prose either way (rm is not at command position there).
  const segs = segments(maskMessageText(command));
  for (const [rule, why] of [...CANON_DENY, ...PROJECT_DENY]) {
    if (segs.some((s) => fires(rule, s, command))) return ["deny", why];
  }
  for (const [rule, why] of [...CANON_ASK, ...PROJECT_ASK]) {
    if (segs.some((s) => fires(rule, s, command))) return ["ask", why];
  }
  return ["allow", "allowed — no gate matched"];
}

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
