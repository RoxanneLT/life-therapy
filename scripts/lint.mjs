#!/usr/bin/env node
/**
 * scripts/lint.mjs — run ESLint over the tree; on worker threads where it runs uncached AND that was measured to pay.
 *
 * @kit lint v2 — tracked OUTSIDE its `KIT:CONFIG` region. The region is yours; everything else is
 * canon's, and `check-kit-drift.mjs` says so if it changes here.
 *
 *   node scripts/lint.mjs              lint; gate it as `"lint": "node scripts/lint.mjs"`
 *   node scripts/lint.mjs --plan       print the ESLint command it would run here, and why
 *   node scripts/lint.mjs --measure    time it uncached: serial, 2 and 4 workers. Writes nothing.
 *   node scripts/lint.mjs --selftest   probes, both directions, against a fake ESLint
 *
 * WHY (pleks CF-23, 2026-10-09). ESLint ≥ 9.34 has `--concurrency`: every file, every rule, split
 * across worker threads — coverage unchanged, unlike a cache. pleks measured its uncached lint at 150s
 * serial and 69s on 4 workers — ON A 24-CORE DESKTOP.
 *
 * ON CI IT SAVED FAR LESS (pleks CF-24, v2). GitHub's 4-vCPU hosted runner took tsc + uncached lint
 * from 225s to 200s, not to half: each worker builds its own TypeScript program, and four of them
 * compete for four vCPUs (inferred, not measured). What cut pleks's CI from ~10m to 4m10s was JOB
 * STRUCTURE — playbook 6 §3a. So a desktop `--measure` decides the LOCAL run only; before WORKERS
 * applies in CI, run `node scripts/lint.mjs --measure` in a CI job and quote that number too.
 *
 * WHY IT IS OFF UNTIL YOU MEASURE. The same day, uncached, warm disk, 24 cores, ESLint 9.39:
 *   life-therapy      serial 32.9s   4 workers 22.8s
 *   blindly           serial 20.8s   4 workers 14.9s
 *   yoros             serial 17.2s   4 workers 14.2s   ESLintPoorConcurrencyWarning
 *   nortiercupboards  serial 11.1s   4 workers 10.7s   ESLintPoorConcurrencyWarning
 *   deckzandwallz     serial  6.3s   4 workers  8.7s   ESLintPoorConcurrencyWarning
 * A small tree pays more to start the threads than they save. So `WORKERS` is 0 until `--measure`
 * says otherwise for THIS tree, and the measurement is quoted into `WORKERS_WHY` beside it.
 *
 * THREE CONDITIONS, each held here rather than in prose:
 *   (a) A rule that aggregates ACROSS files — module-level state it WRITES, e.g. reporting unused
 *       baseline entries, or a third-party one like import/no-unused-modules — sees only its worker's
 *       share. Audit your rules before setting WORKERS, and say so in WORKERS_WHY; WORKERS > 0 with
 *       an empty WORKERS_WHY refuses to run, rather than run on an unaudited claim.
 *   (b) Memory: typed linting builds one TypeScript program PER worker. Capped at 4 (GitHub's hosted
 *       runner has 4 vCPUs) and at the machine's parallelism.
 *   (c) ESLint < 9.34 has no such flag. The installed version is read, never assumed; below it, or
 *       unreadable, the run is serial and says so.
 *
 * UNCACHED PATHS ONLY. On a warm cache almost every file is a hit, the threads start for nothing,
 * and pleks measured workers SLOWER there (12s against 6-10s). CI is always uncached: a fresh runner's
 * cache is cold, so caching there only adds the cost of writing it.
 */
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { availableParallelism, tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

/* KIT:CONFIG lint — yours */
const ARGS = [".", "--max-warnings", "0"]
// null: never cache. A path: cache there on a local run (CI never caches).
const CACHE = null
// A script run before trusting a local cache; a non-zero exit runs uncached instead. pleks: "scripts/eslint-cache-guard.mjs".
const CACHE_GUARD = null
// 0: serial. Set only from `--measure` on this tree, after the cross-file audit in (a).
const WORKERS = 4
// The measurement and the audit, quoted: "2026-10-09 uncached: serial 150s, 4 workers 69s; no rule writes cross-file state".
const WORKERS_WHY = "2026-10-09 uncached: serial 24.1s, 2 workers 20.4s, 4 workers 16.3s (ESLint 9.39.5, 24 cpus); audit: no local rules, 84 rules on, none type-aware, the one import/* rule (no-anonymous-default-export) is per-file, so no rule writes cross-file state"
/* KIT:CONFIG /lint */

const MAX_WORKERS = 4
const FIRST = [9, 34]

/** "9.39.5" → [9, 39]; anything else → null. */
const majorMinor = (v) => {
  const m = /^(\d+)\.(\d+)\./.exec(v ?? "")
  return m ? [Number(m[1]), Number(m[2])] : null
}
const supports = (v) => {
  const mm = majorMinor(v)
  return mm !== null && (mm[0] > FIRST[0] || (mm[0] === FIRST[0] && mm[1] >= FIRST[1]))
}

/**
 * Pure: the ESLint arguments for one run, and why. `guardOk` is null when no guard ran.
 * Returns { args, note, refuse } — `refuse` is a reason the run must not happen.
 */
export function plan({ ci, version, cpus, args = ARGS, cache = CACHE, guardOk = null, workers = WORKERS, why = WORKERS_WHY }) {
  if (workers > 0 && !why.trim()) return { args: [], note: "", refuse: "WORKERS is set and WORKERS_WHY is empty — quote the measurement and the cross-file rule audit (CF-23 (a)) before running on workers" }
  const cached = !ci && cache !== null && guardOk !== false
  const out = [...args]
  if (cached) return { args: [...out, "--cache", "--cache-location", cache], note: "local, cached: serial (workers cost more than they save on a warm cache)", refuse: null }
  const why0 = ci ? "CI, uncached" : cache === null ? "uncached" : "cache guard failed, uncached"
  if (workers <= 0) return { args: out, note: `${why0}: serial (WORKERS is 0)`, refuse: null }
  if (!supports(version)) return { args: out, note: `${why0}: serial — ESLint ${version ?? "(unreadable)"} predates --concurrency (9.34)`, refuse: null }
  const n = Math.min(workers, MAX_WORKERS, cpus)
  if (n < 2) return { args: out, note: `${why0}: serial — ${cpus} cpu(s) leave no room for workers`, refuse: null }
  return { args: [...out, "--concurrency", String(n)], note: `${why0}: ${n} workers`, refuse: null }
}

/** ESLint's own package.json and bin, from this tree — never a global, never npx's guess. */
function eslintAt(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "node_modules", "eslint", "package.json"), "utf8"))
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.eslint
    return bin ? { version: pkg.version, bin: join(root, "node_modules", "eslint", bin) } : null
  } catch {
    return null
  }
}

const run = (bin, args, opts = {}) => spawnSync(process.execPath, [bin, ...args], { stdio: "inherit", ...opts })

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
const flag = (f) => process.argv.includes(f)

if (invoked && flag("--selftest")) process.exit(selftest())
else if (invoked) process.exit(main(process.cwd()))

function main(root) {
  const eslint = eslintAt(root)
  if (!eslint) {
    console.error("[lint] ESLint is not installed in this tree (node_modules/eslint) — failing rather than linting nothing")
    return 1
  }
  if (flag("--measure")) return measure(eslint)
  const ci = Boolean(process.env.CI)
  let guardOk = null
  if (!ci && CACHE !== null && CACHE_GUARD) {
    guardOk = spawnSync(process.execPath, [CACHE_GUARD], { stdio: "inherit" }).status === 0
    if (!guardOk) console.log("[lint] cache guard failed — running UNCACHED rather than trusting a cache it did not verify")
  }
  const p = plan({ ci, version: eslint.version, cpus: availableParallelism(), guardOk })
  if (p.refuse) {
    console.error(`[lint] ${p.refuse}`)
    return 1
  }
  console.log(`[lint] ESLint ${eslint.version}, ${p.note}`)
  if (flag("--plan")) {
    console.log(`  eslint ${p.args.join(" ")}`)
    return 0
  }
  return run(eslint.bin, p.args).status ?? 1
}

function measure(eslint) {
  console.log(`[lint --measure] ESLint ${eslint.version}, ${availableParallelism()} cpus, uncached. The first run warms the disk and is discarded.`)
  if (!supports(eslint.version)) console.log("  this ESLint predates --concurrency: only serial can be measured")
  const runs = [["warm-up", []], ["serial", []]]
  if (supports(eslint.version)) runs.push(["2 workers", ["--concurrency", "2"]], ["4 workers", ["--concurrency", "4"]])
  const rows = []
  for (const [label, extra] of runs) {
    const t = Date.now()
    const r = run(eslint.bin, [...ARGS, ...extra], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" })
    const s = (Date.now() - t) / 1000
    if (label !== "warm-up") rows.push({ label, s, status: r.status, poor: /ESLintPoorConcurrencyWarning/.test(r.stderr ?? "") })
  }
  for (const r of rows) console.log(`  ${r.label.padEnd(10)} ${r.s.toFixed(1).padStart(6)}s  exit ${r.status}${r.poor ? "  ESLintPoorConcurrencyWarning" : ""}`)
  const serial = rows[0]
  const best = rows.slice(1).filter((r) => !r.poor && r.status === serial.status && r.s < serial.s * 0.85).sort((a, b) => a.s - b.s)[0]
  if (!best) {
    console.log("  → keep WORKERS = 0: no worker count beat serial by 15% without ESLint's own warning, at the same exit")
    return 0
  }
  const n = best.label.split(" ")[0]
  console.log(`  → workers pay here. After the cross-file rule audit, set in KIT:CONFIG lint:`)
  console.log(`      const WORKERS = ${n}`)
  console.log(`      const WORKERS_WHY = "${new Date().toISOString().slice(0, 10)} uncached: serial ${serial.s.toFixed(0)}s, ${n} workers ${best.s.toFixed(0)}s; <your audit: no rule writes cross-file state>"`)
  return 0
}

function selftest() {
  let failed = 0
  const ok = (cond, label, extra = "") => {
    if (!cond) failed++
    console.log(`  ${cond ? "✓" : "✗"} ${label}${cond || !extra ? "" : `\n      ${extra}`}`)
  }
  const base = { args: ["."], why: "measured" }
  const has = (p, a) => p.args.join(" ").includes(a)

  ok(has(plan({ ...base, ci: true, version: "9.39.5", cpus: 4, workers: 4, cache: null }), "--concurrency 4"), "CI, uncached, measured, ESLint 9.39: 4 workers")
  ok(has(plan({ ...base, ci: true, version: "10.11.0", cpus: 4, workers: 4, cache: null }), "--concurrency 4"), "ESLint 10 is newer than 9.34 — compared as numbers, not strings")
  ok(!has(plan({ ...base, ci: true, version: "9.33.9", cpus: 4, workers: 4, cache: null }), "--concurrency"), "ESLint 9.33 has no --concurrency: serial (CF-23 (c))")
  ok(!has(plan({ ...base, ci: true, version: undefined, cpus: 4, workers: 4, cache: null }), "--concurrency"), "an unreadable version: serial, not a guess")
  ok(!has(plan({ ...base, ci: true, version: "9.39.5", cpus: 4, workers: 0, cache: null }), "--concurrency"), "KNOWN-GOOD: WORKERS 0 — canon's default — is serial")
  ok(has(plan({ ...base, ci: true, version: "9.39.5", cpus: 24, workers: 8, cache: null }), "--concurrency 4"), "capped at 4 however many are asked for (CF-23 (b))")
  ok(has(plan({ ...base, ci: true, version: "9.39.5", cpus: 2, workers: 4, cache: null }), "--concurrency 2"), "capped at the machine's parallelism")
  ok(!has(plan({ ...base, ci: true, version: "9.39.5", cpus: 1, workers: 4, cache: null }), "--concurrency"), "one cpu: serial")
  const refused = plan({ args: ["."], why: "  ", ci: true, version: "9.39.5", cpus: 4, workers: 4, cache: null })
  ok(refused.refuse !== null, "WORKERS without WORKERS_WHY refuses — an unaudited cross-file claim does not run (CF-23 (a))")
  const local = plan({ ...base, ci: false, version: "9.39.5", cpus: 4, workers: 4, cache: ".eslintcache", guardOk: true })
  ok(has(local, "--cache") && !has(local, "--concurrency"), "local with a cache: cached and serial — workers lose on a warm cache")
  const guardFail = plan({ ...base, ci: false, version: "9.39.5", cpus: 4, workers: 4, cache: ".eslintcache", guardOk: false })
  ok(!has(guardFail, "--cache") && has(guardFail, "--concurrency 4"), "a failed cache guard runs UNCACHED, on workers")
  const ciCache = plan({ ...base, ci: true, version: "9.39.5", cpus: 4, workers: 4, cache: ".eslintcache" })
  ok(!has(ciCache, "--cache") && has(ciCache, "--concurrency"), "CI never caches, even with a cache configured")
  ok(has(plan({ ...base, ci: false, version: "9.39.5", cpus: 4, workers: 4, cache: null }), "--concurrency 4"), "local with no cache is uncached: workers")

  // The real runner against a fake ESLint: the arguments reach it, its exit is the gate's exit.
  const dir = mkdtempSync(join(tmpdir(), "kit lint "))
  try {
    const self = resolve(process.argv[1])
    const go = (env) => spawnSync(process.execPath, [self], { cwd: dir, encoding: "utf8", env: { ...process.env, CI: "", ...env } })
    ok(go({}).status === 1, "no ESLint installed: exit 1, never a silent pass")
    mkdirSync(join(dir, "node_modules", "eslint", "bin"), { recursive: true })
    writeFileSync(join(dir, "node_modules", "eslint", "package.json"), JSON.stringify({ version: "9.39.5", bin: { eslint: "./bin/eslint.js" } }))
    writeFileSync(join(dir, "node_modules", "eslint", "bin", "eslint.js"), "console.log('ARGV ' + JSON.stringify(process.argv.slice(2))); process.exit(Number(process.env.FAKE_EXIT || 0))\n")
    const clean = go({ CI: "1" })
    ok(clean.status === 0 && clean.stdout.includes(`ARGV ${JSON.stringify(plan({ ci: true, version: "9.39.5", cpus: availableParallelism() }).args)}`), "KNOWN-GOOD: the planned arguments reach ESLint and a clean lint passes", clean.stdout + clean.stderr)
    ok(go({ CI: "1", FAKE_EXIT: "1" }).status === 1, "PLANTED: ESLint reporting an error fails the gate")
    ok(go({ CI: "1", FAKE_EXIT: "2" }).status === 2, "an ESLint crash (exit 2) is not a pass")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  console.log(failed ? `\n❌ ${failed} probe(s) wrong` : "\n✅ lint probes green — workers only where uncached, measured, audited and supported")
  return failed ? 1 : 0
}
