/**
 * bash-gate.probe.mjs — KIT FILE, install at `.claude/hooks/`.
 *
 * @kit bash-gate-probe v8 — tracked OUTSIDE its `KIT:CONFIG` regions.
 *
 * BOTH DIRECTIONS, per `ledgers/LESSONS.md` L-01: a planted violation must FAIL
 * and a known-good case must PASS. A pattern that matches nothing reports 100%
 * clean; a pattern that matches everything reports 100% violation; and a
 * half-fixed pattern produces a plausible middle number, which is worse than
 * either. The gate is not trusted until both directions run.
 *
 * FOR THIS HOOK THE ALLOW CASES MATTER MORE THAN THE DENY CASES, which is the
 * reverse of the intuition. The posture is allow-by-default and the hook's
 * PURPOSE is to stop an unattended session stalling on `ls` — so a gate that
 * over-matches has failed at its job while looking maximally safe.
 *
 * v2 carries the decision table measured across four field copies on 2026-09-08.
 * Run this probe against a v1 hook and it goes red on every row v1 got wrong —
 * that output IS the adoption worklist. It resolves the hook from its own
 * location, so it can only ever exercise the file beside it.
 *
 * v5 (2026-09-10) adds the cases v4 could not hold: the protected branch reached BY REFERENCE, some
 * resolved from the command and some from fixture `.git/HEAD` files, and a force-push by `+refspec`
 * (yoros CF-3, CF-5). And one assertion against a witness the config did not write — the remote's
 * default branch — because every other case here derives from the value it would catch (CF-8).
 *
 * v6 (2026-09-11, yoros CF-4) asserts that every rule the hook holds carries a fallback, from the
 * list `bash-gate.js --fallbacks` prints — and holds that list to a witness it did not write: every
 * reason the hook gave in the cases below must belong to a rule on it, or the list is short a rule
 * and no count over it can see that rule. Whether a fallback is ANSWERED, and present in settings,
 * is `check-hook-registration`'s question; canon's own copy ships every one unfilled.
 *
 * v7 (2026-09-11) carries the payloads pleks and yoros measured v6 allowing (pleks CF-9, yoros
 * CF-10), and a DIFFERENTIAL run (pleks CF-10). This file's cases assert what the hook is meant to
 * do, so they cannot show what a replacement stopped doing. `--against <previous bash-gate.js>` puts
 * every case through the previous gate as well, and fails on any verdict that got LOOSER unless the
 * `LOOSENED` table below names it with a reason. Run it before you replace your gate, against the
 * copy you are replacing, so your own rules are in the comparison. v6's probe and pleks's corpus were
 * both green over a gate that allowed 15 payloads its predecessor refused.
 *
 * v8 (2026-09-11, yoros CF-11) adds the message cases: the mask must read `-am`, `-qm`, `-m"…"` and
 * `--message="…"`, and must not read `-Fm` or `-cm`, whose `m` is another flag's value. And three
 * payloads every earlier version allowed — `$(…)` and backticks in a double-quoted message, and a
 * `-m` inside quotes. `LOOSENED` now accumulates across versions: an adopter at v6 runs `--against`
 * its v6, and a table describing only v7→v8 would have called v7's declared loosenings undeclared.
 *
 * Run: node .claude/hooks/bash-gate.probe.mjs   (wire into the `probe` script)
 *      node .claude/hooks/bash-gate.probe.mjs --against <the gate you are replacing>
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, "bash-gate.js");

// THE BRANCH NAMES COME FROM THE HOOK'S OWN CONFIG MODULE, which is the entire point.
//
// They used to be declared here, in a KIT:CONFIG region whose comment asked the reader to keep them
// equal to the hook's — prose doing a check's job on the one value every project changes. A probe
// that reads its subject's configuration from a SECOND copy is a probe that can go green over the
// wrong subject, and that is the failure this file exists to prevent. M-KIT-07, closed 2026-09-09.
import { PROTECTED_BRANCH, WORKING_BRANCH } from "./bash-gate.config.mjs";
// The same module again, as a namespace, for the one OPTIONAL export: a named import of a binding
// your config region does not declare is a load error, and this row must not make you edit it.
import * as branchConfig from "./bash-gate.config.mjs";

/**
 * `raw` sends bytes verbatim. The first malformed-input probe passed a STRING
 * through JSON.stringify, which is valid JSON — nothing was malformed, the hook
 * read `tool_input` off a string, got `undefined`, and ALLOWED. Send garbage as
 * garbage, and send a bare string as a bare string.
 *
 * `root` is the hook's CLAUDE_PROJECT_DIR, and every case without one runs with it REMOVED — not
 * inherited. The hook reads `.git/HEAD` only when it is set, so a case that inherited a session's
 * value would pass or fail by which branch that session had checked out.
 */
function run(payload, { raw = false, root, hook = HOOK } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.CLAUDE_PROJECT_DIR;
    if (root) env.CLAUDE_PROJECT_DIR = root;
    const p = spawn(process.execPath, [hook], { stdio: ["pipe", "pipe", "inherit"], env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => {
      try {
        const o = JSON.parse(out).hookSpecificOutput;
        resolve({ decision: o.permissionDecision, reason: o.permissionDecisionReason ?? "" });
      } catch {
        resolve({ decision: "(no output)", reason: "" });
      }
    });
    p.stdin.end(raw ? payload : JSON.stringify(payload));
  });
}

const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });
const BOM = "\uFEFF";

/**
 * A PROJECT MAY BE STRICTER THAN CANON, AND UNTIL 2026-09-09 THAT MADE THIS ROW UNSHIPPABLE.
 *
 * Reported by the life-therapy session: 7 of 65 probes failed against a CORRECTLY adopted
 * bash-gate v2, and every failure was the project being tighter — it asks on every push where
 * canon allows on a non-protected branch, and denies `git reset --hard` where canon asks.
 *
 *   ✗ want allow got ask   pushing <working-branch> is not the deployment
 *   ✗ want allow got ask   --force-with-lease is the SAFE form and must not be denied
 *   ✗ want ask   got deny  hard reset discards uncommitted work with no undo
 *
 * The probe had a `cases` region for rules a project ADDS and none for verdicts it TIGHTENS, so
 * canon's push and reset policy sat in the file as if it were a canon invariant. It is not: a
 * project's own gate policy is precisely what the hook's config regions exist to vary. And the
 * MANIFEST says the probe ships WITH the gate or the gate does not ship — so the row could not be
 * adopted by anyone stricter than canon, which is the direction you would never want to punish.
 *
 * ⚠ THE ASYMMETRY IS THE WHOLE DESIGN. An override may only make a verdict STRICTER
 * (allow → ask → deny). Loosening one below canon's still fails, and so does naming a `why` that
 * no case carries — the first would be a project quietly switching off a control canon ships, and
 * the second is a rule that stopped applying without anyone noticing. A project may say "we are
 * stricter here". It may never say "do not test this".
 */
const STRICTNESS = { allow: 0, ask: 1, deny: 2 }

/**
 * Apply a project's overrides, and refuse the ones that are not tightenings.
 * Pure, so both directions are probeable without spawning the hook.
 */
export function applyVerdicts(cases, overrides) {
  const findings = []
  const known = new Set(cases.map((c) => c.why))
  for (const why of Object.keys(overrides ?? {})) {
    if (!known.has(why)) {
      findings.push(`verdicts region: no case carries the reason "${why}" — an override for a case that no longer exists is a rule that stopped applying, silently`)
    }
  }
  const out = cases.map((c) => {
    const to = overrides?.[c.why]
    if (to === undefined) return c
    if (!(to in STRICTNESS)) {
      findings.push(`verdicts region: "${c.why}" overridden to \`${to}\`, which is not a verdict. Use allow, ask or deny.`)
      return c
    }
    if (STRICTNESS[to] < STRICTNESS[c.want]) {
      findings.push(
        `verdicts region: "${c.why}" overridden from \`${c.want}\` to \`${to}\` — that is LOOSER than canon. ` +
          `A project may tighten a verdict, never relax one: relaxing switches off a control canon ships.`,
      )
      return c
    }
    return { ...c, want: to, overridden: c.want }
  })
  return { cases: out, findings }
}

/**
 * v6: what is wrong with one rule's fallback, or null. Its SHAPE only — `{ twins: [...] }` or
 * `{ noTwin: "..." }`, exactly one — because a placeholder is a finding in a project and the state
 * canon ships, and settings is not this file's to read.
 */
export function fallbackProblem(fb) {
  if (fb === null || fb === undefined) return "has no fallback — give it { twins: [\"<settings rule>\"] } or { noTwin: \"<why settings cannot say it>\" }";
  if (typeof fb !== "object" || Array.isArray(fb)) return "has a fallback that is not an object";
  const keys = Object.keys(fb);
  if (keys.length !== 1) return `has a fallback with ${keys.length === 0 ? "no key" : `keys ${keys.join(", ")}`} — it takes exactly one of twins or noTwin`;
  if (keys[0] === "twins") {
    const good = Array.isArray(fb.twins) && fb.twins.length > 0 && fb.twins.every((t) => typeof t === "string" && t.trim() !== "");
    return good ? null : "has twins that are not a non-empty list of settings rules";
  }
  if (keys[0] === "noTwin") return typeof fb.noTwin === "string" && fb.noTwin.trim() !== "" ? null : "has a noTwin that is not a reason";
  return `has a fallback keyed ${keys[0]} — it takes exactly one of twins or noTwin`;
}

/**
 * v7: the verdicts canon loosened on purpose, by case `why`, each with the version that loosened it
 * and the reason the previous verdict was wrong. `--against` fails on any looser verdict not named
 * here, and a name that no case carries is itself a finding.
 *
 * v8: THE TABLE ACCUMULATES. v7 replaced it at each version, as if every adopter moved one step at a
 * time; yoros and life-therapy were at v6 when v8 shipped, and against v6 v7's own loosenings would
 * have been undeclared. An entry leaves when its case does.
 */
export const LOOSENED = {
  "PUSH -n is --dry-run, not --no-verify (yoros CF-10)": "v7: v6 denied a dry-run push as if it skipped the project's gate",
  [`MERGE DIRECTION: merging ${PROTECTED_BRANCH} into the working branch leaves ${PROTECTED_BRANCH} alone (pleks CF-8)`]: "v7: v6 read a merge's source as its target and asked",
  [`MERGE DIRECTION: likewise origin/${PROTECTED_BRANCH}`]: "v7: the same, spelled by remote",
  "MESSAGE CLUSTER: -am's value is the message (yoros CF-11)": "v8: v7 masked only a standalone -m, and read -am's message as flags",
  "MESSAGE CLUSTER: -qm likewise": "v8: the same, for any cluster git ends in m",
  'MESSAGE ATTACHED: -m"…" is the message': "v8: v7 masked only a value after a space",
  'MESSAGE ATTACHED: --message="…" is the message': "v8: the same, for --message=",
};

/**
 * v7: compare two gates' verdicts over the same cases. `rows` are `{ why, old, now }`. Pure, so both
 * directions are checked below without a second hook. Returns the undeclared looser rows as findings,
 * and counts for the summary line.
 */
export function differential(rows, loosened) {
  const findings = [];
  let looser = 0;
  let declared = 0;
  let stricter = 0;
  for (const r of rows) {
    if (!(r.old in STRICTNESS) || !(r.now in STRICTNESS)) {
      findings.push(`"${r.why}": the ${r.old in STRICTNESS ? "new" : "previous"} gate gave no verdict (${r.old in STRICTNESS ? r.now : r.old}) — NOT MEASURED, which is not a pass`);
      continue;
    }
    const d = STRICTNESS[r.now] - STRICTNESS[r.old];
    if (d > 0) stricter++;
    if (d >= 0) continue;
    looser++;
    if (Object.hasOwn(loosened, r.why)) declared++;
    else findings.push(`LOOSER: "${r.why}" was ${r.old} and is now ${r.now}, and this version does not say why`);
  }
  return { findings, looser, declared, stricter };
}

/** v6: findings over the hook's rule list, given the reasons the hook was SEEN to give. Pure. */
export function fallbackFindings(inv, seenReasons) {
  if (inv === null || typeof inv !== "object" || !Array.isArray(inv.rules) || !Array.isArray(inv.strays)) {
    return ["`bash-gate.js --fallbacks` printed no rule list, so no rule's fallback can be read"];
  }
  const out = [];
  for (const r of inv.rules) {
    const problem = r.inert ? null : fallbackProblem(r.fallback);
    if (problem) out.push(`${r.severity} rule ${r.rule} ("${String(r.reason).slice(0, 60)}…") ${problem}`);
  }
  for (const k of inv.strays) out.push(`the fallbacks region names ${k}, which is none of canon's rules — a renamed rule leaves its fallback behind`);
  const listed = new Set(inv.rules.map((r) => r.reason));
  for (const reason of seenReasons) {
    if (!listed.has(reason)) out.push(`the hook gave "${reason.slice(0, 70)}…" and no listed rule carries that reason — the list is short a rule`);
  }
  return out;
}

/* KIT:CONFIG verdicts — verdicts THIS project holds more strictly than canon.
 *
 * Keyed by a case's `why` string, which is why those strings are stable. Empty in canon, and empty
 * is the right state unless your gate genuinely differs — a region that restates the default is a
 * fork waiting to happen (L-89).
 *
 * Only TIGHTENING is accepted: allow -> ask -> deny. Example, from the project that reported this:
 *
 *   "hard reset discards uncommitted work with no undo": "deny",
 *   [`pushing ${WORKING_BRANCH} is not the deployment`]: "ask",
 */
/* LT holds two of canon's verdicts tighter, and the twenty-nine entries below are those two policies
 * meeting canon's cases — not twenty-nine separate decisions.
 *
 * PUSH (twenty-five entries; fifteen arrived with canon's v5 cases, four with v7's). A dry-run push
 * asks too: the rule reads `git push`, and a flag that makes it harmless is still a push command a
 * human can glance at. Loosening that was Stéan's call, and on 2026-09-14 Stéan kept it asking. The
 * hook alone could not have loosened it anyway: the `Bash(git push*)` settings ask prompts beside a
 * hook that allows (measured 2026-09-11), and a glob cannot except a dry run without thinning the
 * dead-hook floor under every other push. "Push policy: never push. Commit, report, and wait" (§3) is a standing rule,
 * not a branch rule: Stéan walks the work before it ships, and that is as true on a feature branch
 * as on the deployment. So every case canon lets through because the branch is not `master` is an
 * ask here — including the three safe force forms, which canon is right to keep out of `deny` and
 * which this project still wants a human to see. The two PER-SEGMENT cases are the same policy
 * arriving through a compound command; they are canon's proof that a gate reads segments rather
 * than substrings, and that proof survives at `ask`.
 *
 * RESET (four entries; three arrived with v7's wrapper, keyword and abbreviation cases). §3 lists `git reset --hard` under hook-denied by name. Canon asks because
 * discarding uncommitted work is sometimes what you meant; this repo lost a working day to
 * OneDrive eating the tree (§6) and does not want the one-keystroke version of that available.
 * The recovery is `git stash`, which loses nothing.
 *
 * Both are TIGHTENINGS, which is the only direction this region accepts. Nothing here loosens
 * canon, and if a future canon tightens past this the override becomes a no-op rather than a
 * silent hole. */
const PROJECT_VERDICTS = {
  [`pushing ${WORKING_BRANCH} is not the deployment`]: "ask",
  "--force-with-lease is the SAFE form and must not be denied": "ask",
  "--force-with-lease=<ref> likewise": "ask",
  "--force-if-includes likewise": "ask",
  [`PER-SEGMENT: fetching ${PROTECTED_BRANCH} then pushing elsewhere`]: "ask",
  "PER-SEGMENT: grep's -n is not git's -n": "ask",
  // v5's branch resolution and +refspec cases (adopted 2026-09-11). Each contains a `git push` canon
  // allows because it lands off the protected branch. Here the push itself asks, whichever branch it lands on.
  "+REFSPEC: a refspec with no + is an ordinary push": "ask",
  "+REFSPEC: a + outside a push is not a refspec": "ask",
  "BY REFERENCE: switch away again before a bare push": "ask",
  "BY REFERENCE: a new branch off the protected one, pushed by HEAD": "ask",
  "BY REFERENCE: a FILE checkout does not move the branch": "ask",
  "BY REFERENCE: --tags alone pushes no branch": "ask",
  "HEAD on working: a bare push": "ask",
  "HEAD on working: push origin HEAD": "ask",
  "HEAD on working: redirections are not arguments": "ask",
  "HEAD on working: cd within the repository keeps the branch": "ask",
  "a .git FILE is followed to its gitdir (a worktree on the working branch)": "ask",
  "the command overrides HEAD: switch to working, then push": "ask",
  "HEAD on protected: pushing the working branch by name": "ask",
  "HEAD on protected: --tags alone": "ask",
  "a detached HEAD pushing the working branch by name": "ask",
  // v7's cases (adopted 2026-09-11): the same two policies, reached through a wrapper, a shell
  // keyword, an abbreviation git accepts, and a push flag canon now reads as harmless.
  "PLAN: command -v checks out nothing": "ask",
  "a lease push behind a wrapper is still the safe form": "ask",
  "PUSH -n is --dry-run, not --no-verify (yoros CF-10)": "ask",
  "PUSH --dry-run likewise": "ask",
  "hard reset discards uncommitted work with no undo": "deny",
  "WRAPPER: a hard reset behind timeout": "deny",
  "KEYWORD: a hard reset after then": "deny",
  "ABBREVIATED: --har is --hard to git": "deny",
}
/* KIT:CONFIG /verdicts */

/* KIT:CONFIG loosened — verdicts THIS project accepts as looser than the gate it replaced (v7).
 *
 * Read only by `--against`, and only when the gate you are replacing is your own rather than canon's
 * previous version: `LOOSENED` above already covers canon's own step. Keyed by a case's `why`, each
 * with the reason the old verdict was wrong for you. A verdict that was your POLICY (asking on every
 * push, denying `git reset --hard`) belongs in the hook's deny and ask regions instead, where it
 * holds. Measured on pleks's v4-lineage gate: 39 looser, in exactly those two kinds.
 *
 *   "PROSE: a gated command named in echo's arguments": "our old gate matched a name at any token",
 */
const PROJECT_LOOSENED = {}
/* KIT:CONFIG /loosened */

/**
 * FIXTURE REPOSITORIES FOR THE HEAD READ (v5). Each is a directory whose `.git` holds a HEAD and
 * nothing else, and a case pointed at one runs the hook with CLAUDE_PROJECT_DIR set to it — the
 * harness's own spelling, so there is no seam here the gate could be talked past. The HEAD is the
 * only variable: the same bare `git push` must ASK on one and ALLOW on the other, or a rule that
 * asked on every push, or on none, would pass half of these. From yoros's `bash-gate.refs.probe.mjs`.
 */
const FIXTURES = mkdtempSync(join(tmpdir(), "bash-gate-probe-"));
function fixture(name, head, { gitFile = false } = {}) {
  const root = join(FIXTURES, name);
  mkdirSync(root, { recursive: true });
  if (head === null) return root;
  const gitDir = gitFile ? join(FIXTURES, `${name}-gitdir`) : join(root, ".git");
  mkdirSync(gitDir, { recursive: true });
  writeFileSync(join(gitDir, "HEAD"), head);
  if (gitFile) writeFileSync(join(root, ".git"), `gitdir: ../${name}-gitdir\n`);
  return root;
}
const ON_P = fixture("on-protected", `ref: refs/heads/${PROTECTED_BRANCH}\n`);
const ON_W = fixture("on-working", `ref: refs/heads/${WORKING_BRANCH}\n`);
const DETACHED = fixture("detached", "4ccb06f0000000000000000000000000000000ff\n");
const WORKTREE = fixture("worktree", `ref: refs/heads/${PROTECTED_BRANCH}\n`, { gitFile: true });
// On the protected branch a worktree asks whether or not the `.git` file is followed, because an
// unread HEAD is UNKNOWN and UNKNOWN asks. Only the working-branch worktree proves the follow.
const WORKTREE_W = fixture("worktree-working", `ref: refs/heads/${WORKING_BRANCH}\n`, { gitFile: true });
const NO_GIT = fixture("no-git", null);

/**
 * A WITNESS THE CONFIG DID NOT AUTHOR (v5, yoros CF-8). The hook and this probe read one config
 * module — which closed their old disagreement by giving them a common ancestor, so a mistyped
 * PROTECTED_BRANCH passes both: every case here derives from it. Measured by yoros: set it to a
 * branch that does not exist, and `git push origin main` is ALLOWED under a green probe (L-24).
 *
 * So one value is checked against something else: the remote's default branch, which git records
 * as `refs/remotes/origin/HEAD` and which the config did not write. Three outcomes, and only one
 * of them passes silently:
 *   agrees                 → pass
 *   differs                → FAIL, unless the config declares why (below)
 *   cannot be read         → NOT MEASURED, printed, never a pass (a fresh CI clone has no origin/HEAD)
 *
 * ⚠ A REPO WHOSE DEPLOY BRANCH IS NOT THE REMOTE DEFAULT is legitimate, and it declares so in its
 * config region, with the reason — not by editing this file:
 *
 *   export const PROTECTED_NOT_DEFAULT = "deploys from production; main is the review branch";
 *
 * A declaration while the two AGREE fails: it is an exemption for a case that no longer exists.
 * Pure, so both directions are checked below without a repository.
 */
export function witness(protectedBranch, originHead, declared) {
  const reason = typeof declared === "string" && declared.trim() ? declared.trim() : null;
  if (!originHead) {
    return { ok: true, line: `– NOT MEASURED  PROTECTED_BRANCH "${protectedBranch}" has no witness: refs/remotes/origin/HEAD does not resolve here (\`git remote set-head origin --auto\` records it)` };
  }
  if (originHead === protectedBranch) {
    return reason
      ? { ok: false, line: `✗ PROTECTED_NOT_DEFAULT is declared, but "${protectedBranch}" IS the remote default — the exemption covers nothing; delete it` }
      : { ok: true, line: `✓ PROTECTED_BRANCH "${protectedBranch}" is the remote default (refs/remotes/origin/HEAD)` };
  }
  return reason
    ? { ok: true, line: `✓ PROTECTED_BRANCH "${protectedBranch}" differs from the remote default "${originHead}", declared: ${reason}` }
    : { ok: false, line: `✗ PROTECTED_BRANCH is "${protectedBranch}" but the remote default is "${originHead}". A typo here protects a branch nothing deploys from, under a green probe. Fix the config, or declare PROTECTED_NOT_DEFAULT with the reason` };
}

const WITNESS_SELFTEST = [
  [["main", "main", undefined], true],
  [["main", "master", undefined], false],
  [["production", "main", "deploys from production"], true],
  [["main", "main", "stale"], false],
  [["main", "main", "  "], true],
  [["main", null, undefined], true],
];

/**
 * The remote default, READ rather than asked of git: a hook directory is linted as a security
 * surface in at least one adopter, where spawning a command found on PATH is refused, and the answer
 * is one file. `refs/remotes/origin/HEAD` is a symbolic ref, and git never packs those, so it is
 * loose whenever it exists. Found the way git finds a repository — upward from here — following a
 * `.git` FILE to its gitdir and a worktree's `commondir` to where the refs live. A reftable
 * repository has no loose file, and reads as unresolved: NOT MEASURED, which is honest.
 */
export function originHead(from) {
  let dir = from;
  while (!existsSync(join(dir, ".git"))) {
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
  try {
    let gitDir = join(dir, ".git");
    if (statSync(gitDir).isFile()) {
      const line = readFileSync(gitDir, "utf8").split(/\r?\n/).find((l) => l.startsWith("gitdir:"));
      if (!line) return null;
      gitDir = resolve(dir, line.slice("gitdir:".length).trim());
    }
    const common = join(gitDir, "commondir");
    const refs = existsSync(common) ? resolve(gitDir, readFileSync(common, "utf8").trim()) : gitDir;
    const ref = readFileSync(join(refs, "refs", "remotes", "origin", "HEAD"), "utf8").trim();
    const PREFIX = "ref: refs/remotes/origin/";
    return ref.startsWith(PREFIX) ? ref.slice(PREFIX.length) : null;
  } catch {
    return null;
  }
}

// The reader, both directions, on fixtures: a clone's layout, a worktree's, and one with no record.
const ORIGIN_REPO = fixture("origin-repo", "ref: refs/heads/x\n");
mkdirSync(join(ORIGIN_REPO, ".git", "refs", "remotes", "origin"), { recursive: true });
writeFileSync(join(ORIGIN_REPO, ".git", "refs", "remotes", "origin", "HEAD"), "ref: refs/remotes/origin/trunk\n");
mkdirSync(join(ORIGIN_REPO, "src", "deep"), { recursive: true });
const ORIGIN_WT = join(FIXTURES, "origin-worktree");
mkdirSync(join(ORIGIN_REPO, ".git", "worktrees", "wt"), { recursive: true });
writeFileSync(join(ORIGIN_REPO, ".git", "worktrees", "wt", "commondir"), "../..\n");
mkdirSync(ORIGIN_WT, { recursive: true });
writeFileSync(join(ORIGIN_WT, ".git"), `gitdir: ${join(ORIGIN_REPO, ".git", "worktrees", "wt")}\n`);
const ORIGIN_SELFTEST = [
  [join(ORIGIN_REPO, "src", "deep"), "trunk", "found upward from a subdirectory, as git finds it"],
  [ORIGIN_WT, "trunk", "a worktree's .git file and commondir are followed to the shared refs"],
  [ON_P, null, "a repository with no origin/HEAD recorded is unresolved, not a branch"],
];

const P = PROTECTED_BRANCH;
const W = WORKING_BRANCH;

const CASES = [
  // ── Must ALLOW — the reason this hook exists ───────────────────────────────
  { want: "allow", why: "a plain listing must never prompt", payload: bash("ls -la") },
  { want: "allow", why: "the gate command itself must never prompt", payload: bash("npm run check") },
  { want: "allow", why: "command substitution must not prompt — settings allow-rules cannot cover it", payload: bash("echo $(git rev-parse --short HEAD)") },
  { want: "allow", why: "a heredoc must not prompt — likewise uncoverable by a settings rule", payload: bash("cat << 'EOF'\nhello\nEOF") },
  { want: "allow", why: "a compound with cd must not prompt", payload: bash("cd src && ls") },
  { want: "allow", why: "committing is ordinary work", payload: bash("git commit -m 'feat: x'") },
  { want: "allow", why: "read-only git is never gated", payload: bash("git log --oneline -5") },
  { want: "allow", why: "a BOM-prefixed but valid payload is decided normally (Windows stdin)", raw: true, payload: BOM + JSON.stringify(bash("ls")) },

  // ── Must ALLOW — near-misses that prove the rules are not over-broad ───────
  { want: "allow", why: `pushing ${WORKING_BRANCH} is not the deployment`, payload: bash(`git push origin ${WORKING_BRANCH}`) },
  { want: "allow", why: `a FILENAME containing "${PROTECTED_BRANCH}" is not the branch`, payload: bash(`cat src/${PROTECTED_BRANCH}.ts`) },
  { want: "allow", why: "--force-with-lease is the SAFE form and must not be denied", payload: bash(`git push --force-with-lease origin ${WORKING_BRANCH}`) },
  { want: "allow", why: "--force-with-lease=<ref> likewise", payload: bash(`git push --force-with-lease=${WORKING_BRANCH} origin ${WORKING_BRANCH}`) },
  { want: "allow", why: "--force-if-includes likewise", payload: bash("git push --force-if-includes") },
  { want: "allow", why: "rm of an ordinary path is not rm at a root", payload: bash("rm -rf node_modules/.cache") },
  { want: "allow", why: "rm of a NAMED path under root is not rm at root", payload: bash("rm -rf /tmp/scratch") },
  { want: "allow", why: "rm of a NAMED path under home is not rm at home", payload: bash("rm -rf ~/projects/x") },
  { want: "allow", why: "PER-SEGMENT: an rm and an unrelated `/` in the NEXT command", payload: bash("rm -rf .next && du -sh /") },
  { want: "allow", why: `PER-SEGMENT: fetching ${PROTECTED_BRANCH} then pushing elsewhere`, payload: bash(`git fetch origin ${PROTECTED_BRANCH} && git push origin feature/x`) },
  { want: "allow", why: "PER-SEGMENT: `git clean --dry-run` then a `--format` flag in the NEXT command", payload: bash("git clean --dry-run && npm run build -- --format=json") },
  { want: "allow", why: "PER-SEGMENT: grep's -n is not git's -n", payload: bash('git push > "$LOG" 2>&1; grep -n "vitest" "$LOG"') },
  { want: "allow", why: "COMMAND POSITION: `rm -rf /` inside an awk program is a string, not a command", payload: bash(`awk 'BEGIN{print "rm -rf /"}' f.txt`) },
  { want: "allow", why: "COMMAND POSITION: a commit message that discusses the gate", payload: bash('git commit -m "we ban git push --force and rm -rf /"') },
  { want: "allow", why: "COMMAND POSITION: grepping for a flag is not passing it", payload: bash("grep -rn -- --no-verify .githooks/") },
  { want: "allow", why: "SINK HEREDOC: a commit body may name rm -rf / (the -F - workaround v1 advertised)", payload: bash("git commit -F - <<'MSG'\nfix: gate\n\nWe must never run rm -rf / here.\nMSG") },
  { want: "allow", why: "SINK HEREDOC: prose naming a force-push, fed to cat", payload: bash("cat <<'EOF' > NOTES.md\ngit push --force is banned\nEOF") },
  { want: "allow", why: "-n means --no-stat on merge, not --no-verify", payload: bash(`git merge -n ${WORKING_BRANCH}`) },
  { want: "allow", why: "-n on a non-git command", payload: bash("sort -n numbers.txt") },
  { want: "allow", why: "git -C with a read-only verb", payload: bash("git -C /tmp/d log -1") },
  { want: "allow", why: "the seam rule is inert with no seams configured", payload: bash("SOME_VAR=1 git status") },

  // ── Must ASK ──────────────────────────────────────────────────────────────
  { want: "ask", root: ON_P, why: `merging to ${PROTECTED_BRANCH}`, payload: bash(`git merge ${WORKING_BRANCH} ${PROTECTED_BRANCH}`) },
  { want: "ask", why: `pushing to ${PROTECTED_BRANCH}`, payload: bash(`git push origin ${PROTECTED_BRANCH}`) },
  { want: "ask", why: `pushing to ${PROTECTED_BRANCH} via git -C`, payload: bash(`git -C /tmp/d push origin ${PROTECTED_BRANCH}`) },
  { want: "ask", why: `pushing HEAD:${PROTECTED_BRANCH}`, payload: bash(`git push origin HEAD:${PROTECTED_BRANCH}`) },
  { want: "ask", why: "hard reset discards uncommitted work with no undo", payload: bash("git reset --hard HEAD") },
  { want: "ask", why: "git clean -fd deletes untracked files permanently", payload: bash("git clean -fd") },
  { want: "ask", why: "git clean --force likewise", payload: bash("git clean --force") },
  { want: "ask", why: "unparseable bytes must interrupt, not wave through", raw: true, payload: "{ not json" },
  { want: "ask", why: "valid JSON that is not an OBJECT must also interrupt (bare string)", raw: true, payload: '"a bare string parses fine and has no tool_input"' },
  { want: "ask", why: "valid JSON that is not an OBJECT must also interrupt (array)", raw: true, payload: "[1,2,3]" },
  { want: "ask", why: "valid JSON that is not an OBJECT must also interrupt (number)", raw: true, payload: "42" },
  { want: "ask", why: "a BOM followed by garbage still interrupts", raw: true, payload: BOM + "{ not json" },

  // ── Must DENY ─────────────────────────────────────────────────────────────
  { want: "deny", why: "rm at the filesystem root", payload: bash("rm -rf /") },
  { want: "deny", why: "rm at the filesystem root, glob form", payload: bash("rm -rf /*") },
  { want: "deny", why: "rm at a bare home directory", payload: bash("rm -rf ~") },
  { want: "deny", why: "rm at home, glob form", payload: bash("rm -rf ~/*") },
  { want: "deny", why: "rm at $HOME", payload: bash("rm -rf $HOME") },
  { want: "deny", why: "flags before the target", payload: bash("rm --no-preserve-root -rf /") },
  { want: "deny", why: "ALIAS BYPASS: \\rm", payload: bash("\\rm -rf /") },
  { want: "deny", why: "SUBSHELL: (rm -rf /*)", payload: bash("(rm -rf /*)") },
  { want: "deny", why: "QUOTE HIDE: rm -rf /\"*\"", payload: bash('rm -rf /"*"') },
  { want: "deny", why: "QUOTE HIDE: rm -rf '/'*", payload: bash("rm -rf '/'*") },
  { want: "deny", why: "rm at root followed by another command", payload: bash("rm -rf /*;echo done") },
  { want: "deny", why: "sudo does not launder it", payload: bash("sudo rm -rf /") },
  { want: "deny", why: "SUBSTITUTION is a command position", payload: bash("echo $(rm -rf /)") },
  { want: "deny", why: "BACKTICKS are a command position", payload: bash("x=`rm -rf ~`") },
  { want: "deny", why: "INTERPRETER HEREDOC keeps its body: bash <<EOF", payload: bash("bash <<'EOF'\nrm -rf /\nEOF") },
  { want: "deny", why: "force-push, long form", payload: bash(`git push --force origin ${WORKING_BRANCH}`) },
  { want: "deny", why: "force-push, SHORT form — the most common spelling", payload: bash("git push -f") },
  { want: "deny", why: "force-push, short form in a cluster", payload: bash("git push -fu origin x") },
  { want: "deny", why: "force-push via git -C", payload: bash("git -C /tmp/d push --force") },
  { want: "deny", why: "force-push with the flag last", payload: bash(`git push origin ${WORKING_BRANCH} --force`) },
  { want: "deny", why: "--no-verify skips the project's own commit gate", payload: bash("git commit --no-verify -m wip") },
  { want: "deny", why: "-n on commit IS --no-verify", payload: bash("git commit -n -m x") },
  { want: "deny", why: "--no-verify on push", payload: bash("git push --no-verify") },
  { want: "deny", why: "a QUOTED flag is still the flag once the shell strips the quotes", payload: bash('git commit "--no-verify" -m x') },

  // ── v5: a force-push by REFSPEC, which no --force flag spells (yoros CF-5) ────
  { want: "deny", why: "+REFSPEC: force-push of the working branch", payload: bash(`git push origin +${W}`) },
  { want: "deny", why: "+REFSPEC: force-push of the protected branch", payload: bash(`git push origin +${P}`) },
  { want: "deny", why: "+REFSPEC: src:dst form, via git -C", payload: bash(`git -C /tmp/d push origin +HEAD:${W}`) },
  { want: "deny", why: "+REFSPEC: a lease flag beside it does not launder it", payload: bash(`git push --force-with-lease origin +${W}`) },
  { want: "allow", why: "+REFSPEC: a refspec with no + is an ordinary push", payload: bash(`git push origin HEAD:${W}`) },
  { want: "allow", why: "+REFSPEC: a + outside a push is not a refspec", payload: bash(`git add notes+${P}.md && git push origin ${W}`) },

  // ── v5: the protected branch reached BY REFERENCE, resolved from the command (yoros CF-3) ──
  { want: "ask", why: "BY REFERENCE: check out the protected branch, merge, push — the ordinary deploy", payload: bash(`git checkout ${P} && git merge ${W} && git push`) },
  { want: "ask", why: "BY REFERENCE: switch to the protected branch, then a bare merge", payload: bash(`git switch ${P} && git merge ${W}`) },
  { want: "ask", why: "BY REFERENCE: push HEAD after checking out the protected branch", payload: bash(`git checkout ${P} && git push -u origin HEAD`) },
  { want: "ask", why: "BY REFERENCE: a full ref as the destination", payload: bash(`git push origin ${W}:refs/heads/${P}`) },
  { want: "ask", why: "BY REFERENCE: --all pushes every branch, the protected one included", payload: bash("git push --all origin") },
  { want: "deny", why: "--mirror force-updates and deletes every remote ref: it is a force-push", payload: bash("git push --mirror origin") },
  { want: "ask", why: "BY REFERENCE: gh pr merge lands on a base the command does not name", payload: bash("gh pr merge 12 --merge") },
  { want: "allow", why: "BY REFERENCE: switch away again before a bare push", payload: bash(`git switch ${P} && git switch ${W} && git push`) },
  { want: "allow", why: "BY REFERENCE: a new branch off the protected one, pushed by HEAD", payload: bash(`git checkout ${P} && git checkout -b feature/x && git push -u origin HEAD`) },
  { want: "allow", why: "BY REFERENCE: a FILE checkout does not move the branch", payload: bash(`git checkout ${W} && git checkout -- src/${P}.ts && git push`) },
  { want: "allow", why: "BY REFERENCE: --tags alone pushes no branch", payload: bash("git push --tags") },
  { want: "allow", why: "BY REFERENCE: gh pr view is not a merge", payload: bash("gh pr view 12") },
  { want: "allow", why: "BY REFERENCE: merge --abort merges nothing", payload: bash(`git checkout ${P} && git merge --abort`) },

  // ── v5: the protected branch reached BY REFERENCE, resolved from `.git/HEAD` (fixtures above) ──
  { want: "ask", root: ON_P, why: "HEAD on protected: a bare push", payload: bash("git push") },
  { want: "allow", root: ON_W, why: "HEAD on working: a bare push", payload: bash("git push") },
  { want: "ask", root: ON_P, why: "HEAD on protected: a bare merge", payload: bash(`git merge ${W}`) },
  { want: "allow", root: ON_W, why: "HEAD on working: a bare merge", payload: bash(`git merge ${W}`) },
  { want: "ask", root: ON_P, why: "HEAD on protected: push origin HEAD", payload: bash("git push origin HEAD") },
  { want: "allow", root: ON_W, why: "HEAD on working: push origin HEAD", payload: bash("git push origin HEAD") },
  { want: "ask", root: ON_P, why: "HEAD on protected: a remote and no refspec", payload: bash("git push origin") },
  { want: "ask", root: ON_P, why: "HEAD on protected: pulling ANOTHER branch in is a merge", payload: bash(`git pull origin ${W}`) },
  { want: "ask", root: ON_P, why: "HEAD on protected: redirections are not arguments", payload: bash('git push > "$LOG" 2>&1') },
  { want: "allow", root: ON_W, why: "HEAD on working: redirections are not arguments", payload: bash('git push > "$LOG" 2>&1') },
  { want: "ask", root: ON_P, why: "HEAD on protected: cd within the repository keeps the branch", payload: bash("cd src && git push") },
  { want: "allow", root: ON_W, why: "HEAD on working: cd within the repository keeps the branch", payload: bash("cd src && git push") },
  { want: "ask", root: ON_W, why: "UNKNOWN: cd .. may be another repository", payload: bash("cd .. && git push") },
  { want: "ask", root: ON_W, why: "UNKNOWN: cd to an absolute path outside the repository", payload: bash("cd /tmp/elsewhere && git push") },
  { want: "ask", root: ON_W, why: "UNKNOWN: git -C points at another repository", payload: bash("git -C /tmp/d push") },
  { want: "ask", root: DETACHED, why: "UNKNOWN: a detached HEAD", payload: bash("git push origin HEAD") },
  { want: "ask", root: NO_GIT, why: "UNKNOWN: no .git to read", payload: bash("git push") },
  { want: "ask", root: WORKTREE, why: "a .git FILE is followed to its gitdir (a worktree on the protected branch)", payload: bash("git push") },
  { want: "allow", root: WORKTREE_W, why: "a .git FILE is followed to its gitdir (a worktree on the working branch)", payload: bash("git push") },
  { want: "allow", root: ON_P, why: "the command overrides HEAD: switch to working, then push", payload: bash(`git switch ${W} && git push`) },
  { want: "ask", root: ON_W, why: "the command overrides HEAD: switch to protected, then push", payload: bash(`git switch ${P} && git push`) },
  { want: "ask", root: ON_W, why: "UNKNOWN: checkout - returns to a branch the command does not name", payload: bash("git checkout - && git push") },
  { want: "allow", root: ON_P, why: "HEAD on protected: pushing the working branch by name", payload: bash(`git push origin ${W}`) },
  { want: "allow", root: ON_P, why: "HEAD on protected: a bare pull syncs with its own upstream", payload: bash("git pull") },
  { want: "allow", root: ON_P, why: "HEAD on protected: fetch lands nowhere", payload: bash("git fetch origin") },
  { want: "allow", root: ON_P, why: "HEAD on protected: merge --abort", payload: bash("git merge --abort") },
  { want: "allow", root: ON_P, why: "HEAD on protected: --tags alone", payload: bash("git push --tags") },
  { want: "allow", root: ON_P, why: "HEAD on protected: read-only git", payload: bash("git log --oneline -3") },
  { want: "allow", root: DETACHED, why: "a detached HEAD pushing the working branch by name", payload: bash(`git push origin ${W}`) },
  { want: "allow", root: NO_GIT, why: "no .git, and nothing git", payload: bash("ls") },

  // ── v7: the command behind a wrapper, a keyword or a runner (pleks CF-9 ①, yoros CF-10 (a)) ──
  // Each was ALLOWED by v6, measured in pleks or yoros or both.
  { want: "deny", why: "WRAPPER: timeout and its duration", payload: bash(`timeout 30 git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: timeout with an option that takes a value", payload: bash(`timeout -s KILL 30 git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: stdbuf with an attached option", payload: bash(`stdbuf -oL git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: noglob", payload: bash(`noglob git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: time -p", payload: bash(`time -p git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: nice -n and its value", payload: bash(`nice -n 10 git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: env -i", payload: bash(`env -i git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: sudo -u and its user", payload: bash(`sudo -u root git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: sudo -E before rm", payload: bash("sudo -E rm -rf /*") },
  { want: "deny", why: "WRAPPER: command -p", payload: bash(`command -p git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPER: exec -a and its name", payload: bash(`exec -a x git push -f origin ${W}`) },
  { want: "deny", why: "WRAPPERS NEST: timeout, then nice", payload: bash("timeout --preserve-status 30 nice -n 5 rm -rf /") },
  { want: "deny", why: "RUNNER: xargs", payload: bash("echo x | xargs git push -f origin") },
  { want: "deny", why: "RUNNER: bash -c and its string", payload: bash(`bash -c "git push -f origin ${W}"`) },
  { want: "deny", why: "RUNNER: sh -c and its string", payload: bash("sh -c 'rm -rf /*'") },
  { want: "deny", why: "RUNNER: eval", payload: bash(`eval "git push -f origin ${W}"`) },
  { want: "deny", why: "KEYWORD: then opens a command", payload: bash("if true; then git push -f; fi") },
  { want: "deny", why: "KEYWORD: do opens a command", payload: bash("for i in 1; do rm -rf /; done") },
  { want: "deny", why: "KEYWORD: ! opens a command", payload: bash("! git push -f") },
  { want: "deny", why: "BACKSTOP: a runner in no table (winpty stands in for the next one)", payload: bash("winpty git push -f") },
  { want: "deny", why: "BACKSTOP: find -exec runs its command", payload: bash("find . -exec rm -rf / \\;") },
  { want: "deny", why: "PROCESS SUBSTITUTION is a command position", payload: bash("diff <(rm -rf /) x") },
  { want: "ask", why: "WRAPPER: the protected-branch push behind timeout", payload: bash(`timeout 30 git push origin ${P}`) },
  { want: "ask", why: "WRAPPER: a bare push behind timeout, after checking out the protected branch", payload: bash(`git checkout ${P} && timeout 30 git push`) },
  { want: "ask", why: "WRAPPER: a hard reset behind timeout", payload: bash("timeout 30 git reset --hard") },
  { want: "ask", why: "RUNNER: a protected-branch push inside bash -c", payload: bash(`bash -c "git push origin ${P}"`) },
  { want: "deny", why: "RUNNER: --no-verify inside bash -c", payload: bash('bash -c "git commit --no-verify -m x"') },
  { want: "ask", why: "KEYWORD: a hard reset after then", payload: bash("if true; then git reset --hard; fi") },
  { want: "deny", why: "MESSAGE MASK: an unclosed single quote does not hide a force-push", payload: bash("echo -m 'a\\' && git push -f && echo 'b'") },
  { want: "deny", why: "RUNNER: bash -o and its value before -c", payload: bash(`bash -o pipefail -c "git push -f origin ${W}"`) },
  { want: "deny", why: "BACKSTOP: a backslash does not escape inside single quotes, so what follows is bare", payload: bash("find . -name 'x\\' -exec rm -rf / \\;") },
  // The BACKSTOP finds a wrapped git, rm or gh anywhere, so the table shows in the PLAN: a checkout
  // behind a wrapper still moves HEAD for the push after it, and one behind a query does not.
  { want: "ask", why: "PLAN: a checkout behind timeout moves HEAD", payload: bash(`timeout 30 git checkout ${P} && git push`) },
  { want: "ask", why: "PLAN: a checkout behind nice -n and its value", payload: bash(`nice -n 5 git checkout ${P} && git push`) },
  { want: "ask", why: "PLAN: timeout -- and the duration still owed", payload: bash(`timeout -- 30 git checkout ${P} && git push`) },
  { want: "ask", why: "PLAN: a checkout after then", payload: bash(`if true; then git checkout ${P}; fi; git push`) },
  { want: "allow", why: "PLAN: command -v checks out nothing", payload: bash(`command -v git checkout ${P} && git push`) },
  { want: "ask", root: ON_P, why: "PLAN: a bare push the backstop finds is a push of HEAD", payload: bash("find . -maxdepth 0 -exec git push \\;") },
  // MUST NOT BREAK, from yoros's list and pleks's.
  { want: "allow", why: "command -v names git and runs nothing", payload: bash("command -v git") },
  { want: "allow", why: "PROSE: a wrapper named in echo's arguments", payload: bash("echo timeout 30 rm -rf /") },
  { want: "allow", why: "PROSE: a gated command named in echo's arguments", payload: bash("echo git push -f") },
  { want: "allow", why: "PROSE: grepping for a force-push", payload: bash('grep -rn "git push -f" .') },
  { want: "allow", why: "a -m message naming a wrapped force-push", payload: bash('git commit -m "timeout 30 git push -f"') },
  { want: "allow", why: "a script run by a shell is not the flags it is given", payload: bash("bash scripts/deploy.sh --force") },
  { want: "allow", why: "a lease push behind a wrapper is still the safe form", payload: bash(`timeout 30 git push --force-with-lease origin ${W}`) },
  { want: "allow", why: "QUOTED: a PR body naming gated commands is an argument", payload: bash('gh pr create --body "never rm -rf / or git push -f"') },
  { want: "allow", why: "a wrapper around an ordinary command", payload: bash("nice -n 5 npm run check") },
  { want: "allow", why: "a runner around an ordinary command", payload: bash("xargs -n1 echo") },
  { want: "allow", why: "COMMENT: nothing after a bare # runs", payload: bash("ls # then git push -f") },

  // ── v7: heredocs whose body is not data, and the message mask (pleks CF-9 ②, ③) ──
  { want: "deny", why: "HERE-STRING: <<< feeds one word, and the next lines run", payload: bash("cat <<< EOF\ngit push -f\nEOF") },
  { want: "deny", why: "HEREDOC PIPED ON: a sink's body sent to sh runs", payload: bash("cat <<'EOF' | sh\ngit push -f\nEOF") },
  { want: "deny", why: "UNQUOTED HEREDOC: $(…) in the body runs", payload: bash("cat <<EOF\n$(git push -f)\nEOF") },
  { want: "deny", why: "HEREDOC TO A PROCESS SUBSTITUTION: the body is sent to sh", payload: bash("cat <<'EOF' > >(sh)\ngit push -f\nEOF") },
  { want: "deny", why: "MESSAGE MASK: a backslash does not escape inside single quotes", payload: bash("echo -m 'a\\' && rm -rf /* && echo 'b'") },
  { want: "allow", why: "HEREDOC PIPED ON: a sink's body sent to another sink is still data", payload: bash("cat <<'EOF' | git commit -F -\nnever rm -rf /\nEOF") },
  { want: "allow", why: "UNQUOTED HEREDOC: a body with no substitution is still data", payload: bash("git commit -F - <<EOF\nno rm -rf / here\nEOF") },

  // ── v7: what git's flags actually spell ──
  { want: "allow", why: "PUSH -n is --dry-run, not --no-verify (yoros CF-10)", payload: bash(`git push -n origin ${W}`) },
  { want: "allow", why: "PUSH --dry-run likewise", payload: bash(`git push --dry-run origin ${W}`) },
  { want: "allow", why: "COMMIT -am is all and a message, not -n", payload: bash("git commit -am x") },
  { want: "deny", why: "COMMIT -an: -n inside a cluster is --no-verify", payload: bash("git commit -an -m x") },
  { want: "allow", why: "COMMIT -mn is the message \"n\", and skips nothing", payload: bash("git commit -mn") },
  { want: "deny", why: "ABBREVIATED: --no-veri is --no-verify to git", payload: bash("git commit --no-veri -m x") },
  { want: "deny", why: "core.hooksPath points every hook elsewhere", payload: bash("git -c core.hooksPath=/dev/null commit -m x") },
  { want: "ask", why: "ABBREVIATED: --har is --hard to git", payload: bash("git reset --har") },
  { want: "ask", why: "ABBREVIATED: --forc is --force to git clean", payload: bash("git clean --forc") },

  // ── v7: a merge names its SOURCE (pleks CF-8) ──
  { want: "allow", root: ON_W, why: `MERGE DIRECTION: merging ${P} into the working branch leaves ${P} alone (pleks CF-8)`, payload: bash(`git merge ${P}`) },
  { want: "allow", root: ON_W, why: `MERGE DIRECTION: likewise origin/${P}`, payload: bash(`git merge origin/${P}`) },
  { want: "ask", root: ON_P, why: "MERGE DIRECTION: any merge while on the protected branch lands on it", payload: bash("git merge feature-x") },

  // ── v8: the message flag wherever git reads one (yoros CF-11), and a message that is not inert ──
  { want: "allow", why: "MESSAGE CLUSTER: -am's value is the message (yoros CF-11)", payload: bash('git commit -am "never use --no-verify"') },
  { want: "allow", why: "MESSAGE CLUSTER: -qm likewise", payload: bash('git commit -qm "never use --no-verify"') },
  { want: "allow", why: 'MESSAGE ATTACHED: -m"…" is the message', payload: bash('git commit -m"never use --no-verify"') },
  { want: "allow", why: 'MESSAGE ATTACHED: --message="…" is the message', payload: bash('git commit --message="never use --no-verify"') },
  { want: "deny", why: "MESSAGE CLUSTER: -Fm reads the file m, so the next word is a flag", payload: bash('git commit -Fm "--no-verify"') },
  { want: "deny", why: "MESSAGE CLUSTER: -cm reuses the commit m, so the next word is a flag", payload: bash('git commit -cm "--no-verify"') },
  { want: "deny", why: "MESSAGE CLUSTER: an n before the m is still --no-verify", payload: bash('git commit -anm "fine message"') },
  { want: "deny", why: "MESSAGE CLUSTER: a quoted --no-verify before -am is the flag (yoros CF-11)", payload: bash('git commit "--no-verify" -am x') },
  { want: "deny", why: "MESSAGE FLAG: an -m ending another word starts no message", payload: bash('git commit --author=a-m "--no-verify"') },
  { want: "deny", why: "SUBSTITUTION: a double-quoted message runs its $(…)", payload: bash('git commit -m "$(git push -f)"') },
  { want: "deny", why: "SUBSTITUTION: and its backticks", payload: bash('git commit -m "x `rm -rf /`"') },
  { want: "allow", why: "SUBSTITUTION: in single quotes it is text", payload: bash("git commit -m '$(git push -f)'") },
  { want: "allow", why: "SUBSTITUTION: one that names nothing gated still passes", payload: bash('git commit -m "build $(date +%F)"') },
  { want: "deny", why: "QUOTED -m: a -m inside quotes starts no message", payload: bash(`echo " -m '" && git push -f && echo "'"`) },

  /* KIT:CONFIG cases — this project's own gates, beyond the canonical set above.
   * ONE PROBE PER RULE YOU ADDED TO THE HOOK'S DENY/ASK BLOCKS, both directions: the
   * violation, and the near-miss that must still pass. A rule with no probe is a rule
   * nobody has checked matches what it means to match. */
  // { want: "deny", why: "…", payload: bash("…") },
  /* KIT:CONFIG /cases */
];

const { cases: EFFECTIVE, findings: verdictFindings } = applyVerdicts(CASES, PROJECT_VERDICTS);

let failed = verdictFindings.length;
for (const f of verdictFindings) console.log(`✗ ${f}`);

const DECLARED_LOOSER = { ...LOOSENED, ...PROJECT_LOOSENED };
for (const why of Object.keys(DECLARED_LOOSER)) {
  if (!CASES.some((c) => c.why === why)) {
    failed++;
    console.log(`✗ ${Object.hasOwn(PROJECT_LOOSENED, why) ? "the loosened region" : "LOOSENED"} names "${why}", which no case carries — a declaration for nothing`);
  }
}

// --against <file>: the previous gate, copied beside this directory's files so its imports resolve,
// and as `.mjs` unless it is CommonJS. Nothing is written to your tree.
const againstAt = process.argv.indexOf("--against");
let AGAINST = null;
if (againstAt !== -1) {
  const src = process.argv[againstAt + 1];
  if (!src || !existsSync(src)) {
    console.log(`✗ --against needs the previous bash-gate.js; "${src ?? ""}" does not exist`);
    process.exit(1);
  }
  const dir = mkdtempSync(join(tmpdir(), "bash-gate-against-"));
  for (const f of readdirSync(HERE)) if (statSync(join(HERE, f)).isFile()) copyFileSync(join(HERE, f), join(dir, f));
  const text = readFileSync(src, "utf8");
  const cjs = /\brequire\(/.test(text) && !/^[ \t]*import\b/m.test(text);
  AGAINST = { src, dir, file: join(dir, cjs ? "bash-gate.against.cjs" : "bash-gate.against.mjs"), rows: [] };
  writeFileSync(AGAINST.file, text);
}
// --sample <n>: the first n cases only, which is how the exit-path check below runs this file as a
// child without tripling its time. A sampled run exits 3 when nothing failed, never 0, so it cannot
// stand in for the probe in a gate.
const sampleAt = process.argv.indexOf("--sample");
const SAMPLE = sampleAt === -1 ? null : Number(process.argv[sampleAt + 1]);
if (SAMPLE !== null && !(Number.isInteger(SAMPLE) && SAMPLE > 0)) {
  console.log(`✗ --sample needs a whole number of cases; got "${process.argv[sampleAt + 1] ?? ""}"`);
  process.exit(1);
}
const RUN_CASES = SAMPLE === null ? EFFECTIVE : EFFECTIVE.slice(0, SAMPLE);

let tightened = 0;
const seenReasons = new Set();
const UNPARSED = "could not parse hook input — failing to a prompt, not to silence";
try {
  for (const c of RUN_CASES) {
    const got = await run(c.payload, { raw: c.raw === true, root: c.root });
    if (AGAINST) AGAINST.rows.push({ why: c.why, old: (await run(c.payload, { raw: c.raw === true, root: c.root, hook: AGAINST.file })).decision, now: got.decision });
    const ok = got.decision === c.want;
    if (!ok) failed++;
    if (c.overridden) tightened++;
    const why = got.reason.replace(/^bash-gate: /, "");
    if ((got.decision === "deny" || got.decision === "ask") && why !== UNPARSED) seenReasons.add(why);
    // The override is NAMED on its own line. A project reading a green run must be able to see
    // which verdicts are its own and which are canon's, or the next reader cannot tell a policy
    // decision from a default.
    console.log(
      `${ok ? "✓" : "✗"} want ${c.want.padEnd(5)} got ${got.decision.padEnd(5)}  ${c.why}` +
        (c.overridden ? `  [tightened from ${c.overridden}]` : ""),
    );
  }
  for (const [from, want, why] of ORIGIN_SELFTEST) {
    const got = originHead(from);
    if (got !== want) failed++;
    console.log(`${got === want ? "✓" : "✗"} origin/HEAD reader: want ${String(want).padEnd(5)} got ${String(got).padEnd(5)}  ${why}`);
  }
} finally {
  rmSync(FIXTURES, { recursive: true, force: true });
  if (AGAINST) rmSync(AGAINST.dir, { recursive: true, force: true });
}

// ── v7: the differential, both directions on rows written here, then the run asked for ──
for (const [label, rows, fires] of [
  ["KNOWN-GOOD: unchanged, stricter, and a declared loosening", [{ why: "a", old: "ask", now: "ask" }, { why: "b", old: "allow", now: "deny" }, { why: "d", old: "deny", now: "allow" }], false],
  ["an undeclared loosening fires — the CF-9 shape", [{ why: "x", old: "deny", now: "allow" }], true],
  ["deny to ask is looser too", [{ why: "x", old: "deny", now: "ask" }], true],
  ["a gate that gave no verdict fires, never passes", [{ why: "x", old: "(no output)", now: "deny" }], true],
]) {
  const got = differential(rows, { d: "declared here" }).findings.length > 0;
  if (got !== fires) failed++;
  console.log(`${got === fires ? "✓" : "✗"} differential: ${label}`);
}
if (AGAINST) {
  const d = differential(AGAINST.rows, DECLARED_LOOSER);
  failed += d.findings.length;
  for (const f of d.findings) console.log(`✗ against: ${f}`);
  for (const r of AGAINST.rows) {
    if (STRICTNESS[r.now] < STRICTNESS[r.old] && Object.hasOwn(DECLARED_LOOSER, r.why)) console.log(`✓ against: declared looser — "${r.why}": ${DECLARED_LOOSER[r.why]}`);
  }
  console.log(`⇄ against ${AGAINST.src}: ${AGAINST.rows.length} cases through both gates — ${d.looser} looser (${d.declared} declared), ${d.stricter} stricter`);
  if (d.looser === 0 && d.stricter === 0) {
    console.log("– against: the two gates agreed on every case. If the mechanism changed, these cases do not reach the change: add cases drawn from the diff.");
  }
} else if (SAMPLE === null) {
  // The same path through the process a gate runs (L-51). Against a predecessor that denied
  // everything, the first cases are looser and undeclared, so a child `--against` must exit 1 and
  // name them. It fails here if the run compares this gate with itself, or prints and passes.
  const dir = mkdtempSync(join(tmpdir(), "bash-gate-deny-all-"));
  const denyAll = join(dir, "deny-all.mjs");
  writeFileSync(denyAll, 'process.stdin.resume();\nprocess.stdin.on("end", () => process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: "planted" } })));\n');
  const child = (...args) => spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], { encoding: "utf8" });
  const r = child("--against", denyAll, "--sample", "3");
  rmSync(dir, { recursive: true, force: true });
  const sampled = child("--sample", "1");
  for (const [label, good, got] of [
    ["--against a gate that denied everything exits 1 and names the looser cases", r.status === 1 && r.stdout.includes("✗ against: LOOSER: "), r.status],
    ["a sampled run that passes exits 3, never 0", sampled.status === 3, sampled.status],
  ]) {
    if (!good) failed++;
    console.log(`${good ? "✓" : "✗"} differential: ${label}${good ? "" : ` — got exit ${got}`}`);
  }
}

for (const [args, want] of WITNESS_SELFTEST) {
  if (witness(...args).ok !== want) {
    failed++;
    console.log(`✗ witness(${args.map((a) => JSON.stringify(a)).join(", ")}) should ${want ? "pass" : "fail"}`);
  }
}
const seen = witness(PROTECTED_BRANCH, originHead(HERE), branchConfig.PROTECTED_NOT_DEFAULT);
if (!seen.ok) failed++;
console.log(`\n${seen.line}`);

// ── v6: every rule carries its fallback (yoros CF-4) ──────────────────────────
// Both directions first, on lists written here, then the hook's own.
{
  const rule = (fallback, extra = {}) => ({ severity: "deny", owner: "canon", rule: "r", reason: "a reason", fallback, inert: false, ...extra });
  for (const [label, inv, seenHere, fires] of [
    ["KNOWN-GOOD: a twin, a reason, and an inert rule with neither", { rules: [rule({ twins: ["Bash(x *)"] }), rule({ noTwin: "a glob cannot say it" }, { reason: "b" }), rule(null, { inert: true, reason: "c" })], strays: [] }, ["a reason", "b"], false],
    ["a rule with no fallback fires — the CF-4 shape", { rules: [rule(null)], strays: [] }, [], true],
    ["a fallback with both keys fires", { rules: [rule({ twins: ["Bash(x *)"], noTwin: "and a reason" })], strays: [] }, [], true],
    ["an empty twins list fires", { rules: [rule({ twins: [] })], strays: [] }, [], true],
    ["an empty reason fires", { rules: [rule({ noTwin: "  " })], strays: [] }, [], true],
    ["a key naming no rule fires", { rules: [rule({ noTwin: "x" })], strays: ["isRenamed"] }, [], true],
    ["a reason the hook gave that no listed rule carries fires — the list is short", { rules: [rule({ noTwin: "x" })], strays: [] }, ["a reason", "unlisted"], true],
    ["no list at all fires", { hookSpecificOutput: {} }, [], true],
  ]) {
    const got = fallbackFindings(inv, seenHere).length > 0;
    if (got !== fires) failed++;
    console.log(`${got === fires ? "✓" : "✗"} fallbacks: ${label}`);
  }
  // The list the hook prints, of THIS file or of a copy with lines planted after named anchors. The
  // copy runs beside copies of this directory's files, so its imports resolve, and as `.mjs`, so it
  // is a module whatever your package.json says. Nothing is written to your tree.
  const listOf = (plants = []) => {
    let file = HOOK;
    let dir = null;
    if (plants.length > 0) {
      dir = mkdtempSync(join(tmpdir(), "bash-gate-list-"));
      for (const f of readdirSync(HERE)) if (statSync(join(HERE, f)).isFile()) copyFileSync(join(HERE, f), join(dir, f));
      let src = readFileSync(HOOK, "utf8");
      for (const [anchor, line] of plants) {
        if (!src.includes(anchor)) return { error: `the hook has no \`${anchor}\` to plant beside` };
        src = src.replace(anchor, () => `${anchor}\n${line}`);
      }
      file = join(dir, "bash-gate.planted.mjs");
      writeFileSync(file, src);
    }
    const r = spawnSync(process.execPath, [file, "--fallbacks"], { input: "", encoding: "utf8" });
    if (dir) rmSync(dir, { recursive: true, force: true });
    try {
      return JSON.parse(r.stdout);
    } catch {
      return { error: `exit ${r.status}: ${(r.stderr || r.stdout).trim().split("\n")[0]}` };
    }
  };
  // A PLANTED list, so the hook's own reading is on a probe's path: a key naming no rule, one entry
  // of each table with and without a fallback, and a configured seam, which makes its rule live.
  const planted = listOf([
    ["/* KIT:CONFIG /seams */", 'SEAM_VARS.push("PLANTED_SEAM");'],
    ["const PROJECT_DENY = [", '  [/planted-deny/, "planted deny"],'],
    ["const PROJECT_ASK = [", '  [/planted-ask/, "planted ask", { twins: ["Bash(planted *)"] }],'],
    ["const CANON_FALLBACKS = {", '  isRenamedAway: { noTwin: "planted" },'],
  ]);
  const byReason = (inv, reason) => inv.rules?.find((x) => x.reason === reason);
  const seam = (inv) => inv.rules?.find((x) => x.rule === "isSeamAssignment");
  const emptied = listOf([["/* KIT:CONFIG /seams */", "SEAM_VARS.length = 0;"]]);
  for (const [label, good] of [
    ["planted: a key naming no rule is listed as a stray", JSON.stringify(planted.strays) === '["isRenamedAway"]'],
    ["planted: a project deny with no fallback is listed, fallback null", byReason(planted, "planted deny")?.severity === "deny" && byReason(planted, "planted deny")?.fallback === null],
    ["planted: a project ask's third element is its fallback", byReason(planted, "planted ask")?.severity === "ask" && byReason(planted, "planted ask")?.fallback?.twins?.[0] === "Bash(planted *)"],
    ["planted: a configured seam makes the seam rule live", seam(planted)?.inert === false],
    ["planted: with no seams the seam rule is inert", seam(emptied)?.inert === true],
    ["planted: the planted list's findings name the missing fallback and the stray", fallbackFindings(planted, []).filter((f) => /planted deny|isRenamedAway/.test(f)).length === 2],
  ]) {
    if (!good) failed++;
    console.log(`${good ? "✓" : "✗"} fallbacks: ${label}${good ? "" : ` — got ${JSON.stringify(planted.error ?? emptied.error ?? null)}`}`);
  }
  const inv = listOf();
  const findings = fallbackFindings(inv.error ? null : inv, seenReasons);
  failed += findings.length;
  for (const f of findings) console.log(`✗ fallbacks: ${f}`);
  if (findings.length === 0) {
    const live = inv.rules.filter((x) => !x.inert);
    const twinned = live.filter((x) => x.fallback.twins).length;
    console.log(
      `✓ fallbacks: ${live.length} rule(s), each with one — ${twinned} twinned, ${live.length - twinned} with a reason; ` +
        `${inv.rules.length - live.length} inert. Every reason the cases drew (${seenReasons.size}) is a listed rule's. ` +
        "check-hook-registration fails a reason still unfilled and a twin not in settings.",
    );
  }
}

if (SAMPLE !== null) {
  console.log(`\n– SAMPLED: ${RUN_CASES.length} of ${EFFECTIVE.length} cases, which is not a probe run. ${failed} failed.`);
  process.exit(failed === 0 ? 3 : 1);
}
console.log(
  failed === 0
    ? `\n✅ bash-gate: ${EFFECTIVE.length} probes pass, both directions` +
      (tightened ? `, ${tightened} verdict(s) tightened by this project` : "") + "."
    : `\n❌ bash-gate: ${failed} of ${EFFECTIVE.length} probes FAILED.`,
);
process.exit(failed === 0 ? 0 : 1);
