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

const files = sourceFiles();

// L-10: assert the enumeration before asserting anything about its members. A walk that
// finds nothing reports zero cycles, which is indistinguishable from a clean tree.
const FLOOR = 200;
if (files.length < FLOOR) {
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
