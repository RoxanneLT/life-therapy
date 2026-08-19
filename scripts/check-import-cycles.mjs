#!/usr/bin/env node
/**
 * check-import-cycles.mjs — tier 0 of the crawler spec: circular imports.
 *
 * WHY THIS AND NOT `madge`. The spec names madge, and madge was rejected here on
 * 2026-08-18 because it peer-depends on TypeScript ^5.4.4 while this repo is on 6.0.3.
 * That rejection was reasoned and then stopped, which left the tree with NO circular
 * import detection at all for a class the spec calls "cheap, fast, zero false
 * positives". Sixty lines of owned code has no peer dependency to fight, matches the
 * house style (`architecture-audit.mjs`, `check-schema-drift.mjs`), and can be probed
 * in both directions like every other control here — which madge could not be.
 *
 * WHAT IT FOUND ON ITS FIRST RUN. Two cycles, both the same shape: the booking widget
 * declared the shared `BookingData` interface, and the step components it renders
 * imported that type back from their own parent. The imports were type-only, so
 * TypeScript erased them and nothing failed — which is precisely why it survived. A
 * cycle that costs nothing today still constrains every later change, because the first
 * time a step needs a VALUE from the widget the loop becomes real and the symptom is a
 * module-initialisation error nowhere near the cause. Fixed by moving the type to
 * `components/public/booking/booking-data.ts`; the count has been zero since, so this
 * is a ratchet rather than a baseline.
 *
 * SCOPE. Static `import ... from "…"` only, resolving `@/` and relative specifiers.
 * `require()`, dynamic `import()` and re-export-only cycles are NOT followed — stated
 * because an unstated limit gets trusted past. Tests are excluded: a test importing its
 * subject is not a cycle anyone needs told about.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..").replace(/\\/g, "/");
const SCANNED = ["app", "lib", "components"];
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "generated"]);

function sourceFiles() {
  const out = [];
  for (const d of SCANNED) {
    (function walk(dir) {
      let entries;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (SKIP_DIRS.has(e.name)) continue;
        const p = join(dir, e.name).replace(/\\/g, "/");
        if (e.isDirectory()) walk(p);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
      }
    })(join(ROOT, d).replace(/\\/g, "/"));
  }
  return out;
}

/** Resolve an import specifier to a file on disk, or null for a package import. */
function resolveSpec(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = `${ROOT}/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec).replace(/\\/g, "/");
  else return null;
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand.replace(/\\/g, "/");
  }
  return null;
}

function buildGraph(files) {
  const graph = new Map();
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const deps = new Set();
    for (const m of src.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s*["']([^"']+)["']/g)) {
      const r = resolveSpec(f, m[1]);
      if (r && r !== f) deps.add(r);
    }
    graph.set(f, [...deps]);
  }
  return graph;
}

function findCycles(files, graph) {
  const cycles = [];
  const state = new Map();
  const stack = [];
  function visit(node) {
    state.set(node, "open");
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      if (state.get(dep) === "open") cycles.push([...stack.slice(stack.indexOf(dep)), dep]);
      else if (!state.has(dep)) visit(dep);
    }
    stack.pop();
    state.set(node, "done");
  }
  for (const f of files) if (!state.has(f)) visit(f);
  return cycles;
}

/** A tree this small means the walk is broken, not that the tree is small. */
const FLOOR = 200;

/**
 * L-10, extracted so the fixture can actually exercise it. Inline, the floor could only
 * be "tested" by asserting the constant is positive — a fixture that cannot fail, which
 * is the thing this file exists to be suspicious of.
 */
function enumerationIsSane(count) {
  return count >= FLOOR;
}

// ── selftest ────────────────────────────────────────────────────────────────
/**
 * Adopted from the sibling project, which runs `--selftest` in the SAME gate as the
 * check itself for six of its controls. This one had none: it was probed by hand the day
 * it was written, which proves it worked once and nothing thereafter. A check whose
 * fixtures do not run is a check that can decay to always-green between two commits.
 *
 * Fixtures go to disk and travel the real resolution and graph-building path (L-06) — a
 * hand-built graph object would pass even if `resolveSpec` stopped resolving anything,
 * which is the failure most likely to happen here.
 */
if (process.argv.includes("--selftest")) {
  const { mkdtempSync, writeFileSync, mkdirSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const tmp = mkdtempSync(join(tmpdir(), "cycles-fixture-")).replace(/\\/g, "/");

  const write = (rel, body) => {
    const p = join(tmp, rel).replace(/\\/g, "/");
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, body);
    return p;
  };

  let failed = 0;
  const expect = (name, files, shouldFire) => {
    const found = findCycles(files, buildGraph(files));
    const ok = found.length > 0 === shouldFire;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${shouldFire ? "must fire " : "must pass "} — ${name}`);
  };

  const a = write("a.ts", `import { b } from "./b";\nexport const a = () => b;\n`);
  const b = write("b.ts", `import { a } from "./a";\nexport const b = () => a;\n`);
  expect("a two-file cycle", [a, b], true);

  // The real case this check was written for: the cycle was TYPE-ONLY, so TypeScript
  // erased it and nothing ever failed at runtime. If type imports stop being followed,
  // the only cycles this repo has ever had become invisible.
  const t1 = write("t1.ts", `import type { T } from "./t2";\nexport type S = T | null;\n`);
  const t2 = write("t2.ts", `import type { S } from "./t1";\nexport type T = S | string;\n`);
  expect("a TYPE-ONLY cycle", [t1, t2], true);

  const c = write("c.ts", `import { d } from "./d";\nexport const c = () => d;\n`);
  const d = write("d.ts", `export const d = 1;\n`);
  expect("KNOWN-GOOD: a plain dependency, no cycle", [c, d], false);

  const solo = write("solo.ts", `export const x = 1;\n`);
  expect("KNOWN-GOOD: a file importing nothing", [solo], false);

  // A three-hop cycle: a two-file check that only compared neighbours would miss it.
  const e1 = write("e1.ts", `import { e2 } from "./e2";\nexport const e1 = () => e2;\n`);
  const e2 = write("e2.ts", `import { e3 } from "./e3";\nexport const e2 = () => e3;\n`);
  const e3 = write("e3.ts", `import { e1 } from "./e1";\nexport const e3 = () => e1;\n`);
  expect("a three-file cycle", [e1, e2, e3], true);

  // The enumeration guard, exercised rather than asserted — L-10. A walk that finds
  // nothing reports a clean tree, which is the failure this whole file would hide.
  for (const [name, count, sane] of [
    ["an empty walk is NOT sane", 0, false],
    ["a decayed walk is NOT sane", FLOOR - 1, false],
    ["KNOWN-GOOD: a full walk is sane", FLOOR + 300, true],
  ]) {
    const ok = enumerationIsSane(count) === sane;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${sane ? "must pass " : "must fire "} — ${name}`);
  }

  console.log(failed ? `\n❌ ${failed} fixture(s) wrong` : `\n✅ fixtures green — fires on a cycle, quiet on a plain dependency`);
  process.exit(failed ? 1 : 0);
}

const files = sourceFiles();

// L-10: assert the enumeration before asserting anything about its members. A walk that
// finds nothing reports zero cycles, which is indistinguishable from a clean tree.

if (!enumerationIsSane(files.length)) {
  console.error(
    `\n❌ import-cycles: only ${files.length} files discovered (floor ${FLOOR}).\n` +
      `   The walk is broken or the tree moved — a scan of nothing reports a clean tree.\n`,
  );
  process.exit(1);
}

const cycles = findCycles(files, buildGraph(files));
const short = (p) => p.replace(ROOT + "/", "");

if (cycles.length) {
  console.error(`\n❌ import-cycles: ${cycles.length} circular import(s)\n`);
  for (const c of cycles) console.error(`   ${c.map(short).join("\n     → ")}\n`);
  console.error(
    `   Break the loop by moving what both sides share into its own module — a type\n` +
      `   declared on a component and imported back by its children is the usual shape.\n`,
  );
  process.exit(1);
}

console.log(`🔄 import cycles: none across ${files.length} files`);
