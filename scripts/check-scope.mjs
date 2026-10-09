#!/usr/bin/env node
/**
 * scripts/check-scope.mjs — the commit gate runs what the STAGED diff can affect; push runs everything.
 *
 * @kit check-scope v1 — tracked OUTSIDE its `KIT:CONFIG` region. The region is yours; everything
 * else is canon's, and `check-kit-drift.mjs` says so if it changes here.
 *
 *   node scripts/check-scope.mjs              print the plan for the current index
 *   node scripts/check-scope.mjs --commit     what .githooks/pre-commit runs: branch guard, then the scoped plan
 *   node scripts/check-scope.mjs --push       what .githooks/pre-push runs: the whole chain, never scoped
 *   node scripts/check-scope.mjs --wired      fails unless core.hooksPath is .githooks and both hooks call this file
 *   node scripts/check-scope.mjs --selftest   probes, both directions
 *
 * WHY (pleks M-007 rung 1, E18, 2026-10-02). A commit gate that runs the whole push chain on every
 * commit costs the same for a one-line doc fix as for a schema change: pleks measured 116s for both.
 * Scoped, a docs-only commit was 10.1s and a one-file `lib/` change 65.5s. Four of six projects had
 * NO commit gate at all on 2026-10-09, and the fifth ran its full chain on every commit; a gate that
 * is cheap where the change is cheap is the one that gets installed and kept.
 *
 * WHAT SCOPING MAY NOT DO: make anything reach origin unchecked. Push runs the whole chain (`--push`)
 * and CI runs it again; a step skipped here is skipped for one local commit. The count of commits
 * that passed scoped and then failed the full chain at push IS this map's error rate — each one is a
 * map defect to fix, not a cost of the design. Do not scope the push rung to "save" those.
 *
 * HOW A STEP IS SELECTED. The chain is package.json's `check` split on ` && `; an `npm run X` step is
 * read through to everything X runs. Each step is, in order:
 *   1. your MAP entry for that exact step string, if it has one;
 *   2. otherwise canon's RULES, matched against every command the step expands to. A step whose
 *      commands ALL match a rule selects the union of their globs; ONE unmatched command makes the
 *      whole step "universal". An unrecognised step always runs: never skipped by default.
 *   "universal" runs on every scoped plan. "full" never runs scoped (it still runs at push).
 *
 * FALLS THROUGH TO THE WHOLE CHAIN — fail toward more checking:
 *   · the diff cannot be bounded (no HEAD yet, a shallow clone, a detached HEAD, git failing)
 *   · any path under FORCE_FULL (the gate itself: scripts/**, hooks, settings) or CONFIG (package.json,
 *     lockfiles, tsconfig, every *.config.*): a config change can change what every step means. CONFIG
 *     is checked BEFORE the map, because the source globs would otherwise select eslint.config.mjs.
 *   · a path no step selects that is not INERT (**\/*.md, docs/**)
 *
 * THE DIFF IS THE INDEX, not the working tree: a commit commits what is staged. Against the merge-base
 * with origin's default branch when there is one (so a branch is re-scoped as a whole), else against
 * HEAD (a repo with no remote; every earlier commit passed its own gate). Both sides of a rename and
 * every deletion count: a deleted file still selects the checkers that guarded it.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, posix, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const SRC = "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"
const TS = "**/*.{ts,tsx,mts,cts}"
const TESTDATA = ["**/__tests__/**", "**/__fixtures__/**", "**/*.{test,spec}.*", "**/*.{sql,csv,yml,yaml,txt,html,xml}"]

/* KIT:CONFIG scope — yours. Every value here is the project's; canon's defaults are the empty ones. */
const CHAIN = "check" // the package.json script both rungs run; push runs it whole
const PUSH = "npm run check:push" // the pre-push command: check, then the production build Vercel runs
// true only where the default branch takes commits through PRs alone (5-ARCS §9): it refuses a commit
// on the default branch. A repo that commits straight to its default branch keeps it false.
const BRANCH_GUARD = false
// Exact step string → "universal" | "full" | [globs]. Overrides RULES. Map your own checkers here.
const MAP = {}
// A step that a SCOPED plan runs in a cheaper form, e.g. { "tsc --noEmit --incremental false": "tsc --noEmit" }.
const SCOPED_AS = {}
// Paths beyond canon's FORCE_FULL and CONFIG that change what the chain means.
const EXTRA_FULL = []
/* KIT:CONFIG /scope */

/**
 * Canon's default selection, by what a command RUNS. Order matters: the first match wins. A rule's
 * globs are the files that command reads; when in doubt a rule says "universal", never narrower.
 */
export const RULES = [
  // Reads brief/ (often an untracked symlink no diff can show) or the whole always-loaded file set.
  [/check-brief|delivery-report|check-claude-md|check-install-platform|check-deps-installed|check-mojibake/, "universal"],
  [/\btsc\b|check-baseline\.mjs tsc/, [TS, "**/*.d.ts"]],
  [/\beslint\b|scripts\/lint\.mjs|check-baseline\.mjs eslint/, [SRC, "eslint-rules/**"]],
  [/\bknip\b|\bmadge\b|check-baseline\.mjs (knip|madge)|check-import-cycles/, [SRC]],
  [/\.claude\/hooks\/|check-hook-registration|check-context-budget|check-statusline|check-bash-gate/, [".claude/**"]],
  [/check-commands|check-handoff-contract|agent-distribution|check-agent/, [".claude/**", ".handoff/**"]],
  [/check-git-hooks|check-prepush/, [".githooks/**"]],
  [/\b(vitest|jest)\b|tsx --test|node --test/, [SRC, ...TESTDATA]],
  // A kit script's selftest reads only its own source, and scripts/** already forces the whole chain.
  [/(?:^|\s)(?:\.\/)?scripts\/[\w./-]+\.m?[jt]s --selftest$/, "full"],
]

const FORCE_FULL = ["scripts/**", ".githooks/**", ".claude/hooks/**", ".claude/settings*.json", ...EXTRA_FULL]
export const CONFIG = [
  "package.json", "package-lock.json", "npm-shrinkwrap.json", "pnpm-lock.yaml", "yarn.lock", ".npmrc", ".nvmrc",
  "tsconfig*.json", "jsconfig*.json", "knip.json", "knip.jsonc", ".madgerc", "vercel.json", "next-env.d.ts",
  "*.config.{ts,mts,cts,js,mjs,cjs,json}", "eslint.config.*", ".eslintrc*", "vitest*.config.*", ".releaserc*",
]
const INERT = ["**/*.md", "docs/**"]

const matches = (file, globs) => globs.some((g) => posix.matchesGlob(file, g))

/** A script's ` && `-joined commands, trimmed. A plain split: a regex here backtracks on long chains. */
const andList = (s) => s.split("&&").map((c) => c.trim())

/** Every command a script runs, `npm run X` read through; a self-reference terminates. */
export function expand(scripts, cmd, seen = new Set()) {
  return andList(cmd).flatMap((c) => {
    const m = /^npm run ([\w:.-]+)$/.exec(c.trim())
    if (!m) return [c.trim()]
    if (seen.has(m[1]) || !scripts[m[1]]) return [c.trim()]
    return expand(scripts, scripts[m[1]], new Set([...seen, m[1]]))
  })
}

/**
 * A step's selection: MAP first, else RULES over every command it expands to. Any universal command
 * makes the step universal; a "full" command adds nothing, so `selftest && tsc` stays selected by
 * tsc's globs; a step is "full" only when every command it runs is.
 */
export function select(scripts, step, map = MAP, rules = RULES) {
  if (step in map) return map[step]
  const globs = new Set()
  for (const cmd of expand(scripts, step)) {
    const rule = rules.find(([re]) => re.test(cmd))
    if (!rule || rule[1] === "universal") return "universal"
    if (rule[1] !== "full") for (const g of rule[1]) globs.add(g)
  }
  return globs.size ? [...globs] : "full"
}

/**
 * Pure: the plan for a set of changed paths. `files === null` means the diff could not be bounded.
 * Returns { full, reason, commands }; a full plan runs the chain unchanged.
 */
export function plan(scripts, files, { map = MAP, scopedAs = SCOPED_AS, chain = CHAIN } = {}) {
  const steps = andList(scripts[chain])
  const full = (reason) => ({ full: true, reason, commands: steps })
  if (files === null) return full("the staged diff cannot be bounded")
  if (files.length === 0) return full("nothing staged against the base, so nothing bounds the run")
  const forced = files.find((f) => matches(f, FORCE_FULL))
  if (forced) return full(`${forced} is part of the gate itself`)
  const cfg = files.find((f) => matches(f, CONFIG))
  if (cfg) return full(`${cfg} is configuration`)
  const sel = steps.map((s) => [s, select(scripts, s, map)])
  const loose = files.find((f) => !matches(f, INERT) && !sel.some(([, v]) => Array.isArray(v) && matches(f, v)))
  if (loose) return full(`${loose} is selected by no step and is not inert`)
  const commands = sel
    .filter(([, v]) => v === "universal" || (Array.isArray(v) && files.some((f) => matches(f, v))))
    .map(([s]) => scopedAs[s] ?? s)
  return { full: false, reason: `${files.length} staged path(s)`, commands }
}

const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

/** Staged paths against origin's merge-base, else HEAD; null when nothing honest bounds them. */
export function stagedFiles() {
  try {
    if (git(["rev-parse", "--is-shallow-repository"]) === "true") return null
    git(["symbolic-ref", "-q", "HEAD"]) // throws on a detached HEAD
    git(["rev-parse", "--verify", "-q", "HEAD"]) // throws before the first commit
    let base = "HEAD"
    try { base = git(["merge-base", "HEAD", git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"])]) } catch { /* no remote default: HEAD */ }
    const parts = git(["diff", "--cached", "-M", "--name-status", "-z", base]).split("\0").filter(Boolean)
    const files = []
    for (let i = 0; i < parts.length;) {
      const n = /^[RC]/.test(parts[i++]) ? 2 : 1 // a rename or copy carries both sides
      for (let k = 0; k < n; k++) files.push(parts[i++])
    }
    return [...new Set(files)]
  } catch {
    return null
  }
}

/** The default branch, resolved — never assumed, so a `master` repo is guarded too. */
function defaultBranch() {
  try { return git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, "") } catch { return null }
}

/** Runs a plan in order, stopping at the first failure. `run` is the seam the selftest drives. */
export function execute(p, run) {
  for (const cmd of p.commands) if (run(cmd) !== 0) return { ok: false, failed: cmd }
  return { ok: true, failed: null }
}

const sh = (cmd) => spawnSync(cmd, { stdio: "inherit", shell: true }).status ?? 1
const HOOK_CALLS = { "pre-commit": "scripts/check-scope.mjs --commit", "pre-push": "scripts/check-scope.mjs --push" }

/** The hooks are wired when git reads .githooks and each hook calls this file. Returns findings. */
export function wiring(hooksPath, read) {
  const out = []
  if (hooksPath !== ".githooks") out.push(`core.hooksPath is ${hooksPath ? `"${hooksPath}"` : "unset"}, not ".githooks" — add "prepare": "git config core.hooksPath .githooks || true" to package.json and run it once`)
  for (const [hook, call] of Object.entries(HOOK_CALLS)) {
    const text = read(`.githooks/${hook}`)
    if (text === null) out.push(`.githooks/${hook} is missing`)
    else if (!text.includes(call)) out.push(`.githooks/${hook} does not call ${call}`)
  }
  return out
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
const flag = (f) => process.argv.includes(f)

if (invoked && flag("--selftest")) process.exit(selftest())
else if (invoked) main()

function main() {
  const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts ?? {}
  if (flag("--wired")) {
    let hp = null
    try { hp = git(["config", "core.hooksPath"]) } catch { /* unset */ }
    const found = wiring(hp, (p) => (existsSync(p) ? readFileSync(p, "utf8") : null))
    for (const f of found) console.log(`  ✗ ${f}`)
    console.log(found.length ? "check-scope --wired → the commit and push gates are NOT wired" : "check-scope --wired → .githooks/pre-commit and pre-push are wired")
    process.exit(found.length ? 1 : 0)
  }
  if (flag("--push")) {
    console.log(`pre-push → ${PUSH}`)
    process.exit(sh(PUSH))
  }
  if (!scripts[CHAIN]) {
    console.log(`check-scope → package.json has no "${CHAIN}" script: KIT:CONFIG scope names a chain that does not exist`)
    process.exit(1)
  }
  if (flag("--commit") && BRANCH_GUARD) {
    let branch = ""
    try { branch = git(["branch", "--show-current"]) } catch { /* detached or mid-rebase: not "committing on main" */ }
    const def = defaultBranch() ?? "main"
    if (branch && branch === def) {
      console.error(`pre-commit → REFUSED: this commit would land on '${branch}', the default branch, which takes commits through PRs.`)
      console.error("  Fix it now, while it costs nothing:  git switch -c <type>/<short-description>")
      process.exit(1)
    }
  }
  const p = plan(scripts, stagedFiles())
  const total = andList(scripts[CHAIN]).length
  console.log(p.full ? `check-scope → WHOLE chain (${p.reason})` : `check-scope → ${p.commands.length} of ${total} steps for ${p.reason}`)
  if (!flag("--commit")) {
    for (const c of p.commands) console.log(`  ${c}`)
    process.exit(0)
  }
  const t0 = Date.now()
  const r = p.full ? { ok: sh(`npm run ${CHAIN}`) === 0, failed: `npm run ${CHAIN}` } : execute(p, sh)
  console.log(r.ok ? `check-scope → passed in ${((Date.now() - t0) / 1000).toFixed(1)}s` : `check-scope → FAILED at: ${r.failed}`)
  process.exit(r.ok ? 0 : 1)
}

function selftest() {
  // pleks CF-14: run from a git hook in a linked worktree, git exports an ABSOLUTE GIT_DIR, which
  // beats `-C` — so a scratch repo's commits would land in the REAL repository. A selftest's subject
  // is its fixtures, never the repo the hook was called for, so nothing it or its children run inherits one.
  for (const k of Object.keys(process.env)) if (k.startsWith("GIT_")) delete process.env[k]
  let failed = 0
  const ok = (cond, label, extra = "") => {
    if (!cond) failed++
    console.log(`  ${cond ? "✓" : "✗"} ${label}${cond || !extra ? "" : `\n      ${extra}`}`)
  }
  // A chain shaped like the estate's on 2026-10-09: kit probes behind `npm run`, the tier-0 tools, one
  // project checker canon has no rule for, a test runner.
  const scripts = {
    check: "node scripts/check-install-platform.mjs . && npm run check:hooks && npm run check:brief && npm run typecheck && npm run lint && npm run check:deadcode && node scripts/check-price.mjs && npm run test",
    "check:hooks": "node scripts/check-hook-registration.mjs && node .claude/hooks/bash-gate.probe.mjs",
    "check:brief": "node scripts/check-brief.mjs --selftest && node scripts/check-brief.mjs .",
    typecheck: "tsc --noEmit",
    lint: "eslint --max-warnings 0",
    "check:deadcode": "knip",
    test: "vitest run",
  }
  const has = (p, s) => p.commands.includes(s)
  const universal = ["node scripts/check-install-platform.mjs .", "npm run check:brief", "node scripts/check-price.mjs"]

  ok(JSON.stringify(expand(scripts, "npm run check:hooks")) === JSON.stringify(["node scripts/check-hook-registration.mjs", "node .claude/hooks/bash-gate.probe.mjs"]), "an `npm run` step is read through to the commands it runs")
  ok(expand({ a: "npm run b", b: "npm run a" }, "npm run a").length === 1, "a self-referential script terminates")
  ok(select(scripts, "node scripts/check-price.mjs") === "universal", "a command no rule recognises makes its step universal — never skipped by default")
  ok(select({ x: "tsc --noEmit && node scripts/mystery.mjs" }, "npm run x") === "universal", "ONE unrecognised command in an `npm run` step makes the whole step universal")
  ok(select(scripts, "npm run lint", { "npm run lint": "full" }) === "full", "a MAP entry outranks the rules")
  const bt = select({ t: "node scripts/check-baseline.mjs --selftest && node scripts/check-baseline.mjs tsc" }, "npm run t")
  ok(Array.isArray(bt) && bt.includes(TS), "a selftest beside a tool does not hide the tool: `selftest && tsc` is selected by tsc's globs", JSON.stringify(bt))
  ok(select({ s: "node scripts/check-x.mjs --selftest" }, "npm run s") === "full", "a step that is only a kit selftest never runs scoped — its source is under scripts/**")
  ok(select({ s: "node scripts/check-brief.mjs --selftest" }, "npm run s") === "universal", "KNOWN-GOOD: a universal checker's selftest stays universal (first rule wins)")

  const docs = plan(scripts, ["docs/notes/x.md"])
  ok(!docs.full && JSON.stringify(docs.commands) === JSON.stringify(universal), "a docs-only diff runs exactly the universal steps", JSON.stringify(docs))
  const src = plan(scripts, ["app/page.tsx"])
  ok(!src.full && ["npm run typecheck", "npm run lint", "npm run check:deadcode", "npm run test"].every((s) => has(src, s)), "a source diff runs typecheck, lint, deadcode and tests", JSON.stringify(src.commands))
  ok(!has(src, "npm run check:hooks"), "KNOWN-GOOD: a source diff does not run the hook probes")
  const agent = plan(scripts, [".claude/agents/scout.md"])
  ok(!agent.full && has(agent, "npm run check:hooks") && !has(agent, "npm run lint"), "a .claude/ diff runs the hook probes and not lint", JSON.stringify(agent.commands))
  ok(has(plan(scripts, ["lib/__fixtures__/rates.csv"]), "npm run test"), "a test fixture runs the tests — a test may read it through fs")

  for (const f of ["scripts/check-scope.mjs", ".githooks/pre-commit", ".claude/hooks/bash-gate.js", ".claude/settings.json"]) ok(plan(scripts, [f]).full, `${f} is the gate itself: whole chain`)
  for (const f of ["package.json", "package-lock.json", "tsconfig.json", "eslint.config.mjs", "next.config.ts", "vitest.config.ts", "knip.json"]) {
    const p = plan(scripts, [f, "docs/x.md"])
    ok(p.full && / is configuration/.test(p.reason), `${f} is configuration: whole chain, even beside a docs change`, p.reason)
  }
  ok(matches("eslint.config.mjs", [SRC]), "KNOWN-HAZARD: the source glob matches eslint.config.mjs — CONFIG must outrank the map, and does")
  ok(!matches("lib/package.json.ts", CONFIG), "KNOWN-GOOD: CONFIG matches root files exactly, not a source file that contains the name")
  ok(plan(scripts, ["supabase/config.toml"]).full, "a path no step selects and that is not inert: whole chain")
  ok(plan(scripts, null).full, "a diff that cannot be bounded: whole chain")
  ok(plan(scripts, []).full, "an empty staged diff: whole chain, not zero steps")
  ok(plan(scripts, ["app/old/page.tsx", "docs/moved.md"]).commands.includes("npm run lint"), "the OLD side of a rename still selects its checkers")
  const scoped = plan({ ...scripts, typecheck: undefined, check: "tsc --noEmit --incremental false" }, ["a.ts"], { scopedAs: { "tsc --noEmit --incremental false": "tsc --noEmit" } })
  ok(JSON.stringify(scoped.commands) === JSON.stringify(["tsc --noEmit"]), "SCOPED_AS swaps a step for its cheaper form in a scoped plan")
  ok(plan(scripts, ["package.json"]).commands.length === scripts.check.split(" && ").length, "KNOWN-GOOD: a whole-chain plan is the chain unchanged")

  // The runner decides the exit, step by step.
  ok(!execute(src, (c) => (c === "npm run lint" ? 1 : 0)).ok, "PLANTED: a selected step that fails BLOCKS the commit")
  ok(execute(src, () => 0).ok, "KNOWN-GOOD: a clean tree passes")
  ok(execute(docs, (c) => (c === "npm run lint" ? 1 : 0)).ok, "a failing step the diff does not select does not decide a docs-only commit")

  // Wiring, both directions.
  const hooks = { ".githooks/pre-commit": `#!/bin/sh\nexec node ${HOOK_CALLS["pre-commit"]}\n`, ".githooks/pre-push": `#!/bin/sh\nexec node ${HOOK_CALLS["pre-push"]}\n` }
  ok(wiring(".githooks", (p) => hooks[p] ?? null).length === 0, "KNOWN-GOOD: hooksPath set and both hooks calling this file is wired")
  ok(wiring(null, (p) => hooks[p] ?? null).length === 1, "an unset core.hooksPath is not wired — git would run nothing")
  ok(wiring(".githooks", (p) => (p.endsWith("pre-push") ? null : hooks[p])).length === 1, "a missing pre-push is not wired")
  ok(wiring(".githooks", (p) => (p.endsWith("pre-commit") ? "#!/bin/sh\nnpm run check\n" : hooks[p])).length === 1, "a pre-commit that does not call this file is not wired")

  // The real diff reader, in a scratch repository: staged paths only, renames carry both sides.
  const dir = mkdtempSync(join(tmpdir(), "check scope "))
  const env = process.env
  const g =(...a) => execFileSync("git", ["-C", dir, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env })
  const cwd = process.cwd()
  try {
    g("init", "-q", "-b", "main"); g("config", "user.email", "s@t"); g("config", "user.name", "s"); g("config", "commit.gpgsign", "false")
    writeFileSync(join(dir, "a.ts"), "1"); writeFileSync(join(dir, "old.md"), "x")
    g("add", "."); g("commit", "-q", "-m", "init")
    writeFileSync(join(dir, "a.ts"), "2"); writeFileSync(join(dir, "unstaged.ts"), "3")
    g("mv", "old.md", "new.md"); g("add", "a.ts")
    process.chdir(dir)
    const files = stagedFiles()
    ok(JSON.stringify(files?.sort()) === JSON.stringify(["a.ts", "new.md", "old.md"]), "the reader sees staged paths and both sides of a rename, never an unstaged file", JSON.stringify(files))
    g("commit", "-q", "-m", "two"); g("checkout", "-q", "--detach")
    ok(stagedFiles() === null, "a detached HEAD is unbounded: the reader answers null, so the plan is the whole chain")
  } finally {
    process.chdir(cwd)
    rmSync(dir, { recursive: true, force: true })
  }

  // THE HOOKS THEMSELVES, driven by real commits and pushes. Canon passes its kit copies with
  // `--hook`; a project's own .githooks/ is used when none is passed.
  const given = process.argv.flatMap((a, i) => (process.argv[i - 1] === "--hook" ? [a] : []))
  const hookFiles = Object.fromEntries(Object.keys(HOOK_CALLS).map((h) => [h, given.find((p) => p.endsWith(h)) ?? `.githooks/${h}`]))
  if (Object.values(hookFiles).some((p) => !existsSync(p))) {
    console.log(`  ⊘ the hooks were NOT exercised: ${Object.values(hookFiles).filter((p) => !existsSync(p)).join(", ")} not found`)
  } else {
    const repo = mkdtempSync(join(tmpdir(), "check scope hooks "))
    const remote = mkdtempSync(join(tmpdir(), "check scope remote "))
    const r = (args, cwdAt = repo) => spawnSync("git", ["-C", cwdAt, ...args], { encoding: "utf8", env })
    const commits = () => Number(r(["rev-list", "--count", "HEAD"]).stdout.trim() || 0)
    const gate = (code) => writeFileSync(join(repo, "gate.txt"), String(code))
    try {
      r(["init", "-q", "-b", "main"]); r(["config", "user.email", "s@t"]); r(["config", "user.name", "s"]); r(["config", "commit.gpgsign", "false"])
      r(["init", "-q", "--bare", "-b", "main"], remote)
      mkdirSync(join(repo, "scripts")); mkdirSync(join(repo, ".githooks"))
      writeFileSync(join(repo, "scripts", "check-scope.mjs"), readFileSync(resolve(process.argv[1]), "utf8"))
      for (const [h, p] of Object.entries(hookFiles)) { writeFileSync(join(repo, ".githooks", h), readFileSync(p, "utf8")); chmodSync(join(repo, ".githooks", h), 0o755) }
      writeFileSync(join(repo, "package.json"), JSON.stringify({ scripts: { check: "node chain.mjs" } }))
      writeFileSync(join(repo, "chain.mjs"), 'import { readFileSync } from "node:fs"\nprocess.exit(Number(readFileSync("gate.txt", "utf8")))\n')
      r(["config", "core.hooksPath", ".githooks"])
      const wired = spawnSync(process.execPath, ["scripts/check-scope.mjs", "--wired"], { cwd: repo, encoding: "utf8", env })
      ok(wired.status === 0, "KNOWN-GOOD: a repository with the hooks installed and core.hooksPath set reports wired", wired.stdout)
      gate(0); r(["add", "."]); r(["commit", "-q", "-m", "first"])
      ok(commits() === 1, "KNOWN-GOOD: pre-commit lets a commit through when the chain is green")
      gate(1); writeFileSync(join(repo, "notes.md"), "x"); r(["add", "notes.md"])
      const refused = r(["commit", "-q", "-m", "second"])
      ok(commits() === 1 && /check-scope/.test(refused.stdout + refused.stderr), "PLANTED: pre-commit REFUSES a commit when a step its scope selects fails", refused.stdout + refused.stderr)
      gate(0); r(["add", "gate.txt"]); r(["commit", "-q", "-m", "second"])
      r(["remote", "add", "origin", remote])
      gate(1)
      const blocked = r(["push", "-q", "origin", "main"])
      ok(blocked.status !== 0 && r(["rev-parse", "--verify", "-q", "main"], remote).status !== 0, "PLANTED: pre-push REFUSES a push when the whole chain fails — nothing reaches the remote", blocked.stderr)
      gate(0)
      const pushed = r(["push", "-q", "origin", "main"])
      ok(pushed.status === 0 && r(["rev-parse", "--verify", "-q", "main"], remote).status === 0, "KNOWN-GOOD: pre-push lets a green chain through", pushed.stderr)
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(remote, { recursive: true, force: true })
    }
  }

  console.log(failed ? `\n❌ ${failed} probe(s) wrong` : "\n✅ check-scope probes green — scopes by the staged diff, whole chain on the gate, config or the unknown")
  return failed ? 1 : 0
}
