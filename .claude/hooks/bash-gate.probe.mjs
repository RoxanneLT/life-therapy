/**
 * bash-gate.probe.mjs — KIT FILE, install at `.claude/hooks/`.
 *
 * @kit bash-gate-probe v3 — tracked OUTSIDE its `KIT:CONFIG` regions.
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
 * Run: node .claude/hooks/bash-gate.probe.mjs   (wire into the `probe` script)
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "bash-gate.js");

/* KIT:CONFIG branches — the two branch names this project's ASK gate turns on.
 * WORKING is the everyday branch, which must never prompt; PROTECTED is whatever
 * the deployment runs from, and must match the hook's KIT:CONFIG branch region. */
// PROTECTED must match bash-gate.js's own KIT:CONFIG branch region: `master`, because Vercel
// builds from it and there is no separate deploy step (§3).
// WORKING is a synthetic stand-in for "any branch that is not the deployment" — deliberately not
// a branch this repo currently has, since branches come and go and a probe input that names one
// would start failing for a reason that has nothing to do with the gate. `feature/x` is the
// spelling canon's own per-segment case already uses.
const WORKING_BRANCH = "feature/x";
const PROTECTED_BRANCH = "master";
/* KIT:CONFIG /branches */

/**
 * `raw` sends bytes verbatim. The first malformed-input probe passed a STRING
 * through JSON.stringify, which is valid JSON — nothing was malformed, the hook
 * read `tool_input` off a string, got `undefined`, and ALLOWED. Send garbage as
 * garbage, and send a bare string as a bare string.
 */
function run(payload, { raw = false } = {}) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [HOOK], { stdio: ["pipe", "pipe", "inherit"] });
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
/* LT holds two of canon's verdicts tighter, and the seven entries below are those two policies
 * meeting canon's cases — not seven separate decisions.
 *
 * PUSH (six entries). "Push policy: never push. Commit, report, and wait" (§3) is a standing rule,
 * not a branch rule: Stéan walks the work before it ships, and that is as true on a feature branch
 * as on the deployment. So every case canon lets through because the branch is not `master` is an
 * ask here — including the three safe force forms, which canon is right to keep out of `deny` and
 * which this project still wants a human to see. The two PER-SEGMENT cases are the same policy
 * arriving through a compound command; they are canon's proof that a gate reads segments rather
 * than substrings, and that proof survives at `ask`.
 *
 * RESET (one entry). §3 lists `git reset --hard` under hook-denied by name. Canon asks because
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
  "hard reset discards uncommitted work with no undo": "deny",
}
/* KIT:CONFIG /verdicts */

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
  { want: "ask", why: `merging to ${PROTECTED_BRANCH}`, payload: bash(`git merge ${WORKING_BRANCH} ${PROTECTED_BRANCH}`) },
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

let tightened = 0;
for (const c of EFFECTIVE) {
  const got = await run(c.payload, { raw: c.raw === true });
  const ok = got.decision === c.want;
  if (!ok) failed++;
  if (c.overridden) tightened++;
  // The override is NAMED on its own line. A project reading a green run must be able to see
  // which verdicts are its own and which are canon's, or the next reader cannot tell a policy
  // decision from a default.
  console.log(
    `${ok ? "✓" : "✗"} want ${c.want.padEnd(5)} got ${got.decision.padEnd(5)}  ${c.why}` +
      (c.overridden ? `  [tightened from ${c.overridden}]` : ""),
  );
}

console.log(
  failed === 0
    ? `\n✅ bash-gate: ${EFFECTIVE.length} probes pass, both directions` +
      (tightened ? `, ${tightened} verdict(s) tightened by this project` : "") + "."
    : `\n❌ bash-gate: ${failed} of ${EFFECTIVE.length} probes FAILED.`,
);
process.exit(failed === 0 ? 0 : 1);
