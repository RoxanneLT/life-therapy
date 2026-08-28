#!/usr/bin/env node
/**
 * scripts/check-handoff-contract.mjs — every handoff artefact carries a well-formed contract block.
 *
 * WHY THIS EXISTS: the return contract (dev-standards/playbooks/4-AGENT-PIPELINES.md §3) is the
 * labelled block an agent emits to its caller. That channel is a TRANSCRIPT — nothing can inspect it
 * after the fact, so an agent that returns bullets of its own devising instead is a silent failure.
 * The spine therefore also requires the block as the artefact's FINAL section, on disk, where a
 * check can reach it. Without this file the contract is prose in six spines and nothing more, which
 * is the shape this project keeps having to fix (CLAUDE.md §3: "prose, and prose does not hold").
 *
 * PROVENANCE, stated because a comment that claims someone else's incident as ours is a lie a later
 * reader cannot detect: this check is ported from the sibling project (`pleks`), and every
 * MEASUREMENT below — the ReDoS timings, the census ordering count, the rollout-lag incident — is
 * THAT project's, taken on its machine, and says so at the site. What is LT's own is the set
 * derivation immediately below, which was re-measured here rather than inherited.
 *
 * THE MISSING-vs-NONE DISTINCTION IS THE POINT. `Promote    none` is a considered result and the
 * normal one for an entry agent; an ABSENT Promote line is a contract failure. Collapsing them
 * would delete the only signal this file exists to carry, so a missing line is a finding and
 * `none` is not.
 *
 * THE GLYPH IS DELIBERATE REDUNDANCY. The verdict line carries both a glyph and a word, and this
 * check asserts they agree. A verdict whose gloss contradicts its own state ("⛔ proceed") is a real
 * failure and is invisible in a bare word — the second encoding is what makes it detectable.
 *
 * SCOPE AND ITS HONEST LIMIT: `.handoff/` is gitignored and task-scoped scratch, so on a clean tree
 * this check validates ZERO files and passes. A check that cannot fire is usually a defect; here it
 * is the design. The two mitigations are that the live run PRINTS ITS DENOMINATOR (so "0 artefacts"
 * is visible rather than implied) and that `--selftest` carries fixtures in both directions. That
 * second half is not optional — canon's own finding is that an assertion over `[]` executes nothing
 * and reports green, so a synthetic fixture is mandatory for a check whose real input set is
 * normally empty.
 *
 * Run: node scripts/check-handoff-contract.mjs             (wired into `npm run test:gate`)
 *      node scripts/check-handoff-contract.mjs --selftest  (probes both directions)
 */
import { readdirSync, readFileSync, statSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from "node:fs"
import { join, dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..").replace(/\\/g, "/")
const HANDOFF = "/.handoff"

/**
 * The five labels, in the order the block prints them. Order is part of the contract — a human scans
 * the column, and `Agent`/`Verdict` are what they scan for first.
 */
const LABELS = ["Agent", "Verdict", "Summary", "Artefact", "Promote"]

/** Glyph → the verdict word it must accompany. There is no fourth pair. */
const GLYPHS = { "✅": "proceed", "⚠": "decision-needed", "⛔": "stop" }
const VERDICTS = new Set(Object.values(GLYPHS))

/**
 * Agents whose SPINE emits the contract block. The check enforces the block only for these, because
 * a rule cannot be enforced on an agent that was never told it — an artefact with no block, from an
 * agent whose spine never asked for one, is the spine's state and not the agent's failure.
 *
 * DERIVED HERE, NOT INHERITED, 2026-08-28. The sibling project's copy of this file carries a long
 * scar about the set lagging its spines: four spines gained the block and this set was not widened,
 * so the check reported green having validated one agent and skipped everyone else. Copying its
 * membership across would have reproduced the answer without reproducing the check, so the sets
 * below were measured against LT's own `.claude/agents/*.md`:
 *
 *     census 1 · db-inspector 1 · grounder 1 · implementer 1 · walker 1 · crawler-doctrine 0
 *
 * for both `^Promote ` (the block) and `^anchor: task=` (the anchor template). Five and five. The
 * two sets are identical here because LT's splice was a SINGLE ACT — every spine arrived from canon
 * in one commit — which is exactly the condition under which the sibling's lag could not occur.
 *
 * THE RULE THAT PREVENTS THE LAG, and it is theirs, learned expensively: an agent added here must be
 * added in the same commit that ships its spine. The other half of the design is what made their
 * hole recoverable — SKIPPED ARTEFACTS ARE NAMED ON EVERY RUN. A boundary widened by hand WILL be
 * forgotten, so it has to be loud. That is kept.
 *
 * `crawler-doctrine` is deliberately absent and is NOT a lag. Its stdout is parsed as a single JSON
 * object by `scripts/crawl.mjs`, so a trailing fenced block would break the parse — and the
 * exemption is written into its own spine (§"Why you carry no return-contract block, when every
 * other agent does") so a later reader does not close it as a gap. Verified present there before
 * this set was written, rather than assumed from the sibling.
 *
 * `main` is likewise absent: the main session has no spine to carry the rule, and `NN-main.md` is
 * its own working notes.
 */
export const CONTRACT_AGENTS = new Set(["grounder", "census", "walker", "db-inspector", "implementer"])

/**
 * Agents whose spine specifies the machine-readable ANCHOR LINE. A separate name from the set above
 * even though the two are currently IDENTICAL, and the split is the point rather than an accident.
 *
 * The sibling learned this the hard way: widening the contract set in one move switched on TWO
 * assertions, not one, and only one of them had shipped. Four spines said "anchor your claims" in
 * prose and never gave the syntax, so their agents wrote `Commit anchor: a5b6f541` and failed a
 * check that greps for a line. Here both halves arrived together, so there is nothing to lag — but
 * the set is kept as its own name because the NEXT agent added may well carry one and not the other,
 * and folding it away now would make that a discovery instead of a decision.
 *
 * The containment invariant is what is asserted in the probes, deliberately NOT equality: an anchor
 * rule on an agent whose artefacts are never checked would be unreachable, and that holds whether
 * the sets are equal or not. The sibling's first version of that probe asserted a strict subset and
 * broke the moment its rollout caught up — encoding a transient state as an invariant.
 */
export const ANCHOR_AGENTS = new Set(["grounder", "census", "walker", "db-inspector", "implementer"])

/** Every `NN-<agent>.md` under a handoff root. Non-recursive past the task-slug level, by design. */
export function artefacts(root) {
  const base = `${root}${HANDOFF}`
  if (!existsSync(base)) return []
  const out = []
  for (const slug of readdirSync(base)) {
    const dir = join(base, slug)
    try { if (!statSync(dir).isDirectory()) continue } catch { continue }
    for (const f of readdirSync(dir)) {
      if (/^\d{2}-[a-z-]+\.md$/.test(f)) out.push(join(dir, f).replace(/\\/g, "/"))
    }
  }
  return out.sort()
}

/** The agent name a `NN-<agent>.md` filename encodes, or null if the name does not parse. */
export function agentOf(path) {
  const m = /\/\d{2}-([a-z-]+)\.md$/.exec(path.replace(/\\/g, "/"))
  return m ? m[1] : null
}

/** Split discovered artefacts into the ones the contract applies to and the ones it does not. */
export function partition(paths) {
  const enforced = [], skipped = []
  for (const p of paths) (CONTRACT_AGENTS.has(agentOf(p)) ? enforced : skipped).push(p)
  return { enforced, skipped }
}

/**
 * Read one label's value. The block is column-aligned, so the separator is a RUN OF SPACES, not a
 * colon — `[ \t]{2,}` rather than `:`. Captured to end of line: matching `(\S+)` would read an
 * unfilled placeholder's first token as a valid value and wave the whole template through.
 *
 * `[ \t]` THROUGHOUT, never `\s`, for two reasons — the first found by a probe rather than by
 * reading, and both measured in the sibling project:
 *   1. QUADRATIC. `^\s*` under /m re-consumes the whole trailing newline run at every line start —
 *      a 60k-blank-line artefact took 20 SECONDS there, and this runs once per label. Note for
 *      anyone trusting a linter here: `sonarjs/super-linear-regex` did not flag it and COULD not,
 *      because the pattern is assembled through `new RegExp` and the rule reads regex LITERALS. The
 *      control is aimed at the spelling, not the class.
 *   2. CORRECTNESS. `\s{2,}` as the column separator could cross a newline and read the NEXT line's
 *      text as this label's value, turning a malformed block into a plausible one.
 */
const valueOf = (text, l) => (text.match(new RegExp(`^[ \\t]*${l}[ \\t]{2,}(.+?)[ \\t]*$`, "m")) ?? [])[1]

/** Parse cap — see the block in `checkArtefact` for why refusing beats truncating. */
const MAX_ARTEFACT_BYTES = 1024 * 1024

/**
 * Validate one artefact's trailing contract block. Returns findings, empty when well-formed.
 *
 * Deliberately tolerant about WHERE the block sits (last section, not last byte) and strict about
 * WHAT it contains. An agent that adds a trailing newline or a closing fence has not broken the
 * contract; an agent that drops Promote has.
 */
export function checkArtefact(path, text, enforceAnchor = true) {
  const out = []

  // ── INPUT SIZE CAP ──────────────────────────────────────────────────────────────────────────────
  // Every bound below is per-pattern: each says "this regex stays linear". None says anything about
  // the SUM. `checkArtefact` runs ~8 passes over `text`, so a 200MB artefact is slow at linear time
  // — bounded complexity and bounded work are different claims, and only the first was established.
  //
  // The producer is an AGENT, which is the least controlled input this file sees. A contract block
  // is a few hundred bytes; the artefact around it is prose. 1MB is ~two orders of magnitude above
  // anything real and still parses instantly.
  //
  // A REFUSAL, not a truncation. Truncating would parse the head and report a well-formed contract
  // for a file whose block sits past the cut — a false PASS on the exact input that tripped the cap.
  if (text.length > MAX_ARTEFACT_BYTES) {
    out.push(
      `${path}: artefact is ${(text.length / 1024 / 1024).toFixed(1)}MB, over the ${MAX_ARTEFACT_BYTES / 1024 / 1024}MB parse cap — not parsed. ` +
      `A handoff artefact is prose around a few hundred bytes of contract block; this size means a runaway writer or a pasted binary, not a contract to validate.`,
    )
    return out
  }

  const missing = LABELS.filter((l) => valueOf(text, l) === undefined)
  if (missing.length === LABELS.length) {
    out.push(`${path}: no contract block at all — the labelled lines are the agent's return, and this artefact carries none`)
    return out
  }
  for (const l of missing) {
    out.push(`${path}: contract block is missing its ${l} line${l === "Promote" ? ' — "Promote    none" is a line, and its ABSENCE is the failure this check exists to separate from it' : ""}`)
  }

  // Anchor: a machinery map is a grounding claim, so an artefact with no anchor is itself a finding
  // (CLAUDE.md §8). Gated on ANCHOR_AGENTS — see its comment. The default is ENFORCE, so a caller
  // that forgets the flag over-checks rather than under-checks.
  // `[ \t]*`, NOT `\s*`, for the quadratic reason given at `valueOf`. One claim worth recording
  // rather than repeating, from the sibling's review: the cross-line match is real but
  // OUTCOME-EQUIVALENT — any position `\s*` reaches by crossing newlines is itself a line start, and
  // `.*` cannot cross one, so the boolean was never different. The quadratic is the whole defect.
  if (enforceAnchor && !/^[ \t]*anchor:.*\bcommit=/m.test(text)) {
    out.push(`${path}: no anchor line carrying a commit — an unanchored observation is a finding, not a fact`)
  }

  // An UNFILLED template passes every label test above — every line is present, it just says
  // `<pipeline id from the brief>`. Angle-bracket placeholders are the tell, checked on every line
  // rather than only the verdict. A bare `—` is NOT a placeholder: it is the SPECIFIED value for
  // "the brief named no pipeline", and the spines say so.
  for (const l of LABELS) {
    const v = valueOf(text, l)
    // BOUNDED at 200. `<[^>]+>` is the classic unclosed-delimiter quadratic: on a run of `<` with no
    // `>`, every start position consumes the tail and backtracks a character at a time. ASCII art, a
    // diagram, or a nested generic produces exactly that run. No real placeholder is 200 characters,
    // and the probes assert BOTH halves — a normal placeholder still fires, and the cost of the
    // bound is stated rather than left implicit.
    if (v !== undefined && /<[^>]{1,200}>/.test(v)) {
      out.push(`${path}: ${l} still holds the spine's placeholder ("${v}") — the block was copied, not filled in`)
    }
  }

  const verdict = valueOf(text, "Verdict")
  if (verdict !== undefined && !/<[^>]{1,200}>/.test(verdict)) {   // bounded — see the note above
    // Strip the variation selector: ⚠️ is ⚠ + U+FE0F, and only one of those spellings is typed.
    const v = verdict.replace(/️/g, "")
    const glyph = Object.keys(GLYPHS).find((g) => v.startsWith(g))
    const word = [...VERDICTS].find((w) => new RegExp(`\\b${w}\\b`).test(v))
    if (!glyph) {
      out.push(`${path}: Verdict "${verdict}" carries no state glyph — must open with ${Object.keys(GLYPHS).join(" ")}`)
    }
    if (!word) {
      out.push(`${path}: Verdict "${verdict}" names no state — must be one of ${[...VERDICTS].join(", ")}`)
    }
    if (glyph && word && GLYPHS[glyph] !== word) {
      out.push(`${path}: Verdict glyph and word disagree — "${glyph}" means ${GLYPHS[glyph]}, the line says ${word}`)
    }
  }
  return out
}

const isEntry = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))

if (isEntry && process.argv.includes("--selftest")) {
  let failed = 0
  const ok = (c, l) => { if (!c) failed++; console.log(`  ${c ? "✓" : "✗"} ${l}`) }

  const GOOD = [
    "anchor: task=m-041 · agent=grounder · utc=2026-08-28T14:07:11Z · commit=7f7ba3d0",
    "",
    "## 1. Machinery map",
    "…",
    "## Contract",
    "",
    "```",
    "Agent      grounder · P1 · step 1 of 3",
    "Verdict    ✅ proceed — nothing to decide",
    "",
    "Summary    Mapped. Buildable as specified. 12 sites, 2 need a naming call.",
    "",
    "Artefact   .handoff/m-041/01-grounder.md",
    "Promote    none",
    "```",
    "",
  ].join("\n")

  ok(checkArtefact("a.md", GOOD).length === 0,
    "KNOWN-GOOD: a well-formed block with Promote none is clean")

  // THE distinction. Both of these have "no promotion" as the outcome; only one is a defect.
  ok(checkArtefact("a.md", GOOD.replace(/^Promote.*$/m, "")).some((f) => f.includes("Promote")),
    "a MISSING Promote line fires — it is a contract failure")
  ok(!checkArtefact("a.md", GOOD).some((f) => f.includes("Promote")),
    "…and a PRESENT `Promote    none` does NOT fire — the considered answer is the normal one")

  ok(checkArtefact("a.md", GOOD.replace(/^Summary.*$/m, "")).some((f) => f.includes("Summary")),
    "a missing Summary line fires")
  ok(checkArtefact("a.md", GOOD.replace(/^Agent.*$/m, "")).some((f) => f.includes("Agent")),
    "a missing Agent routing line fires")
  ok(checkArtefact("a.md", GOOD.replace("grounder · P1 · step 1 of 3", "grounder · — · —")).length === 0,
    "KNOWN-GOOD: `—` in the routing slots is the SPECIFIED value when the brief named none, not a placeholder")

  ok(checkArtefact("a.md", "# Just a map\n\n## 1. Machinery map\nstuff\n").some((f) => f.includes("no contract block at all")),
    "an artefact with NO block at all fires once, not five times")
  ok(checkArtefact("a.md", GOOD.replace(/^anchor:.*$/m, "")).some((f) => f.includes("anchor")),
    "a missing anchor fires — an unanchored observation is a finding")

  // The anchor split, both directions. The uncovered half must be provably quiet, or the split is
  // just a comment; the covered half must still fire, or widening ANCHOR_AGENTS would prove nothing.
  ok(!checkArtefact("a.md", GOOD.replace(/^anchor:.*$/m, ""), false).some((f) => f.includes("anchor")),
    "…and is SILENT for a spine that never specified the anchor line — the split, not a qualified tag")
  ok(checkArtefact("a.md", GOOD.replace(/^anchor:.*$/m, ""), false).length === 0,
    "…while that same artefact is otherwise fully checked — the split withholds one assertion, not the check")
  // SUBSET, not STRICT subset — deliberately. The sets are equal today; asserting `<` would encode a
  // transient state as an invariant, which is the exact mistake the sibling made and had to undo.
  ok([...ANCHOR_AGENTS].every((a) => CONTRACT_AGENTS.has(a)),
    "ANCHOR_AGENTS ⊆ CONTRACT_AGENTS — an anchor rule on an unenforced agent would be unreachable")

  // The glyph pair, both directions.
  ok(checkArtefact("a.md", GOOD.replace("✅ proceed — nothing to decide", "⛔ proceed — nothing to decide")).some((f) => f.includes("disagree")),
    "a glyph contradicting its own word fires — the whole reason the state is encoded twice")
  ok(checkArtefact("a.md", GOOD.replace("✅ proceed — nothing to decide", "⚠️ decision-needed — one call for Main")).length === 0,
    "KNOWN-GOOD: ⚠️ with its variation selector pairs with decision-needed and is clean")
  ok(checkArtefact("a.md", GOOD.replace("✅ proceed — nothing to decide", "proceed")).some((f) => f.includes("no state glyph")),
    "a bare word with no glyph fires")
  ok(checkArtefact("a.md", GOOD.replace("✅ proceed — nothing to decide", "✅ looks-fine")).some((f) => f.includes("names no state")),
    "an invented verdict word fires")

  ok(checkArtefact("a.md", GOOD.replace("grounder · P1 · step 1 of 3", "grounder · <pipeline id from the brief> · step <N> of <M>")).some((f) => f.includes("placeholder")),
    "an UNFILLED template echoed back fires — it passes every label test and is still not a report")

  // Discovery, walked for real: a block-shaped file that is not an artefact must not be scanned,
  // and an artefact in a task directory must be found.
  const tmp = mkdtempSync(join(tmpdir(), "handoff-")).replace(/\\/g, "/")
  // Built from ONE segment, not `join(tmp, ".claude", "handoff", …)`. The handoff root moved out of
  // `.claude/` here on 2026-08-28 (it is a PROTECTED PATH — see `.claude/hooks/agent-write-scope.js`),
  // and in the sibling that same move swept every string literal in the repo and missed a fixture
  // precisely because its path was assembled from parts. A fixture that spells its path differently
  // from production is a fixture that can drift silently.
  mkdirSync(join(tmp, ".handoff", "m-041"), { recursive: true })
  writeFileSync(join(tmp, ".handoff", "m-041", "01-grounder.md"), GOOD)
  writeFileSync(join(tmp, ".handoff", "m-041", "notes.md"), "scratch, not an artefact")
  ok(artefacts(tmp).length === 1, "discovery finds NN-<agent>.md and ignores scratch files beside it")
  ok(artefacts(join(tmp, "nope")).length === 0, "a tree with no handoff directory yields nothing rather than throwing")
  rmSync(tmp, { recursive: true, force: true })

  ok(agentOf(".handoff/t/01-grounder.md") === "grounder", "agentOf reads the agent out of the filename")
  ok(agentOf(".handoff/t/03-db-inspector.md") === "db-inspector", "…including a hyphenated agent name")
  ok(agentOf("notes.md") === null, "…and returns null rather than guessing when the name does not parse")

  // The rollout boundary, probed in BOTH directions. A boundary that only ever lets things through
  // is indistinguishable from a disabled check.
  const P = (n) => `.handoff/t/${n}`
  const split = partition([
    P("01-grounder.md"), P("02-census.md"), P("03-walker.md"),
    P("04-db-inspector.md"), P("05-implementer.md"),
    P("06-crawler-doctrine.md"), P("07-main.md"),
  ])
  ok(split.enforced.length === 5,
    "MUST ENFORCE — all five LT spines that carry the block, measured 2026-08-28, not just grounder")
  ok(["grounder", "census", "walker", "db-inspector", "implementer"].every((a) => split.enforced.some((p) => agentOf(p) === a)),
    "…and each of the five is named individually, so dropping one from the set fails here rather than silently narrowing the aperture")

  // The boundary must still EXCLUDE something, or it has stopped being a boundary and these probes
  // have stopped testing one. Both exclusions are permanent by design, not lag.
  ok(split.skipped.length === 2,
    "MUST SKIP — crawler-doctrine (stdout is parsed JSON by scripts/crawl.mjs; a fenced block breaks it) and main (no spine)")
  ok(split.skipped.some((p) => agentOf(p) === "crawler-doctrine") && split.skipped.some((p) => agentOf(p) === "main"),
    "…and they are those two specifically — a skip list that drifted to something else is not this exemption")

  // The honest cost of the boundary, asserted rather than left implicit: a skipped artefact is not
  // checked AT ALL, so a malformed block in one is invisible. This probe exists so that the day a
  // spine is added to CONTRACT_AGENTS, the person doing it sees what they are switching on.
  ok(partition([P("06-crawler-doctrine.md")]).enforced.length === 0,
    "a crawler-doctrine artefact is skipped even when it DOES carry a block — the boundary is by agent, not by content")

  // ── ReDoS bounds, both directions ────────────────────────────────────────────────────────────
  // These patterns run over AGENT-WRITTEN artefacts — the least controlled input this file sees.
  // The second half is the half that matters: a bound that BREAKS the match is a silently disabled
  // check, which is the failure this repo keeps finding. So the placeholder is asserted to still
  // fire FIRST, and the timing second.
  ok(checkArtefact("a.md", GOOD.replace("Promote    none", "Promote    <what to promote>")).some((f) => f.includes("placeholder")),
    "KNOWN-GOOD: an ordinary placeholder still fires with the 200-char bound in place")
  ok(checkArtefact("a.md", GOOD.replace("Promote    none", `Promote    <${"x".repeat(199)}>`)).some((f) => f.includes("placeholder")),
    "…and one exactly at the bound still fires")
  // THE HONEST COST, asserted rather than left implicit: past 200 chars a placeholder is no longer
  // detected. Cheap — the spines' longest real placeholder is 31 characters — but a real aperture,
  // and a probe is where a cost like this stays visible instead of living in a comment.
  ok(!checkArtefact("a.md", GOOD.replace("Promote    none", `Promote    <${"x".repeat(201)}>`)).some((f) => f.includes("placeholder")),
    "…and one PAST the bound does not — the aperture the bound buys, stated")

  const timed = (text) => {
    const t0 = process.hrtime.bigint()
    checkArtefact("a.md", text)
    return Number(process.hrtime.bigint() - t0) / 1e6
  }
  // THE SIBLING'S MEASUREMENTS, each pattern in isolation on its own fixture, on ITS machine:
  //   <[^>]+>   120k '<'      5850ms   →  <[^>]{1,200}>        58ms   (100×)
  //   ^\s*…     60k newlines  1871ms   →  ^[ \t]*…              0ms
  //   valueOf   60k newlines  1837ms   →  [ \t] throughout      0ms
  // THRESHOLD 1000ms. The probe's job is to separate linear from quadratic, and the gap it separates
  // is 100× — so a tighter line buys no discriminating power, while on a loaded CI box it turns a
  // shared-runner hiccup into a red build with no code change, which is how a timing probe gets
  // deleted rather than fixed. 1000ms sits ~5× above the slowest fixed measurement and ~6× below the
  // fastest broken one, so reverting either bound fails it by a wide margin. Now that CI runs the
  // whole gate (`.github/workflows/ci.yml`), that headroom is load-bearing rather than theoretical.
  const THRESHOLD_MS = 1000
  const bracketMs = timed(GOOD.replace("Promote    none", `Promote    ${"<".repeat(120_000)}`))
  ok(bracketMs < THRESHOLD_MS, `a 120k-'<' run with no '>' completes in ${bracketMs.toFixed(0)}ms — bounded, not quadratic`)
  const blankMs = timed(`${"\n".repeat(60_000)}anchor: task=t · commit=abc1234\n${GOOD}`)
  ok(blankMs < THRESHOLD_MS, `a 60k-newline blank region completes in ${blankMs.toFixed(0)}ms — [ \\t]* cannot cross lines`)

  // ── The input size cap, both directions ──────────────────────────────────────────────────────
  ok(checkArtefact("a.md", GOOD).length === 0,
    "KNOWN-GOOD: an ordinary artefact is nowhere near the parse cap and is checked normally")
  {
    const over = checkArtefact("a.md", `${GOOD}\n${"x".repeat(1024 * 1024)}`)
    ok(over.length === 1 && over[0].includes("parse cap"),
      "an artefact past the parse cap is REFUSED with one finding — not truncated, which would report a well-formed contract for a file whose block sits past the cut")
  }

  console.log(failed ? `\n❌ ${failed} probe(s) wrong` : "\n✅ probes green — fires on a missing, unfilled or self-contradicting block, quiet on a well-formed one, and enforces only the spines that carry it")
  process.exit(failed ? 1 : 0)
}

if (isEntry && !process.argv.includes("--selftest")) {
  const { enforced, skipped } = partition(artefacts(ROOT))
  const findings = enforced.flatMap((f) =>
    checkArtefact(f.replace(ROOT + "/", ""), readFileSync(f, "utf8"), ANCHOR_AGENTS.has(agentOf(f))))

  // Named before the verdict, pass or fail. An artefact outside the rollout boundary is a thing the
  // check DID NOT LOOK AT, and a reader has to see that without reading the source.
  if (skipped.length) {
    console.log(`   not checked — no contract block required of this writer (crawler-doctrine: stdout is parsed JSON; main: no spine):`)
    for (const f of skipped) console.log(`     · ${f.replace(ROOT + "/", "")}`)
  }

  if (findings.length) {
    console.error(`\n❌ handoff-contract: ${findings.length} finding(s) across ${enforced.length} artefact(s)\n`)
    for (const f of findings) console.error(`   ${f}`)
    console.error("")
    process.exit(1)
  }
  // The denominator is printed deliberately: `.handoff/` is task-scoped scratch and is empty on a
  // clean tree, so "0 artefacts" has to be VISIBLE rather than read as "all artefacts passed".
  console.log(`🤝 handoff-contract: ${enforced.length} artefact(s) carry a well-formed contract block`)
}
