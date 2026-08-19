#!/usr/bin/env node
/**
 * crawl.mjs — invoke a read-only crawler, parse its JSON, print the report.
 *
 * SPEC_CODEBASE_CRAWLERS §5, at the size the spec's D5 asks for TODAY. v1 of that spec
 * mandated stable IDs, fingerprint dedup and a six-state ledger before the first crawler
 * ran. That was right facing a 300-finding first run; here the audit reports zero across
 * its checks and knip is at zero, so there is no volume to manage, and a ledger built now
 * is a queue for work that is not arriving.
 *
 * The ledger gets built when either trigger fires — a run produces more than one sitting
 * can clear, or a second run re-emits findings from the first. Until then the run IS the
 * report, and this wrapper stays small enough to read.
 *
 * WHAT IS HONOURED FROM DAY ONE, because retrofitting them is what goes wrong:
 *   · D3 — the agent never writes anything. It emits JSON on stdout; this parses it. The
 *     agent's tool list has no Write and no Edit, so read-only is enforced by the grant
 *     rather than by the prompt asking nicely.
 *   · D4 — the finding cap is asserted here, not just requested in the prompt. A crawler
 *     that ignores its cap is handing triage back to the reader, which is the resource
 *     this whole spec exists to protect.
 *   · The parser is guarded. The CLI's JSON envelope carries `result`, `is_error` and
 *     cost fields; read what is needed, default what is missing, assume nothing exists.
 *
 * Usage:
 *   node scripts/crawl.mjs crawler-doctrine
 *   node scripts/crawl.mjs crawler-doctrine --scope lib/email        (first runs: scope small)
 *   node scripts/crawl.mjs crawler-doctrine --dry-run                (print the command only)
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_FINDINGS = 12; // must match the cap in the agent's spine

const args = process.argv.slice(2);
const agent = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const scopeIdx = args.indexOf("--scope");
const scope = scopeIdx >= 0 ? args[scopeIdx + 1] : null;

if (!agent) {
  console.error("usage: node scripts/crawl.mjs <agent-name> [--scope <path>] [--dry-run]");
  process.exit(2);
}

const agentFile = join(ROOT, ".claude/agents", `${agent}.md`);
if (!existsSync(agentFile)) {
  console.error(`❌ no such crawler: .claude/agents/${agent}.md`);
  process.exit(2);
}

// The allowlist is a build blocker (D6). Running without it produces a first report that
// flags deliberate design, and a crawler only gets one first impression.
const intentional = join(ROOT, ".claude/crawlers/INTENTIONAL.md");
if (!existsSync(intentional)) {
  console.error(`❌ .claude/crawlers/INTENTIONAL.md is missing — refusing to run.`);
  console.error(`   Without it the first run flags deliberate design as defects (D6).`);
  process.exit(2);
}

const prompt = scope
  ? `Crawl ONLY the path "${scope}" and emit the JSON findings object.`
  : `Run a full crawl of the repository and emit the JSON findings object.`;

// Read-only allowlist. Never --dangerously-skip-permissions: a read-only grant means no
// permission prompt can fire, so an unattended run completes WITHOUT removing the guardrail.
const argv = [
  "-p", prompt,
  "--agent", agent,
  "--output-format", "json",
  "--allowedTools", "Read,Grep,Glob",
  "--max-turns", "40",
];

if (dryRun) {
  console.log(`claude ${argv.map((a) => (a.includes(" ") ? JSON.stringify(a) : a)).join(" ")}`);
  process.exit(0);
}

let raw;
try {
  raw = execFileSync("claude", argv, { cwd: ROOT, encoding: "utf8", maxBuffer: 32e6 });
} catch (err) {
  console.error(`❌ crawler invocation failed: ${err.shortMessage ?? err.message}`);
  if (err.stdout) console.error(String(err.stdout).slice(0, 2000));
  process.exit(1);
}

/** The CLI envelope. Every field defaulted — never assume one exists. */
let envelope = {};
try {
  envelope = JSON.parse(raw);
} catch {
  console.error("❌ the CLI did not return JSON. First 500 characters:\n");
  console.error(raw.slice(0, 500));
  process.exit(1);
}

if (envelope.is_error) {
  console.error(`❌ the crawler reported an error: ${envelope.result ?? "(no detail)"}`);
  process.exit(1);
}

/** The agent's own payload, which arrives as a string inside `result`. */
const body = typeof envelope.result === "string" ? envelope.result : JSON.stringify(envelope.result ?? {});
const jsonStart = body.indexOf("{");
let report;
try {
  report = JSON.parse(body.slice(jsonStart));
} catch {
  console.error("❌ the crawler emitted something other than the JSON object it was asked for.");
  console.error("   The contract is: no preamble, no markdown fence, one object. Got:\n");
  console.error(body.slice(0, 500));
  process.exit(1);
}

const findings = Array.isArray(report.findings) ? report.findings : [];
const cost = typeof envelope.total_cost_usd === "number" ? ` · $${envelope.total_cost_usd.toFixed(2)}` : "";

console.log(`\n${agent}${scope ? ` · scope ${scope}` : ""} — ${findings.length} finding(s)${cost}\n`);

if (findings.length > MAX_FINDINGS) {
  console.log(`⚠ cap exceeded: ${findings.length} findings against a limit of ${MAX_FINDINGS}.`);
  console.log(`  An uncapped report hands triage back to the reader, which is the thing the cap`);
  console.log(`  protects. Treat this run as untriaged.\n`);
}

for (const f of findings) {
  const sev = String(f.severity ?? "?").toUpperCase().padEnd(6);
  console.log(`  [${sev}] ${f.title ?? "(untitled)"}`);
  for (const loc of f.locations ?? []) console.log(`           ${loc}`);
  if (f.rule) console.log(`           rule: ${f.rule}`);
  if (f.case) console.log(`           case: ${f.case}`);
  if (f.why_no_check) console.log(`           no check because: ${f.why_no_check}`);
  if (f.suggested_action) console.log(`           do: ${f.suggested_action}`);
  if (f.escalation_candidate) console.log(`           ⚑ believes this class should become a check`);
  console.log();
}

if (!findings.length) {
  console.log("  Nothing. An empty result is a valid answer — this crawler only looks at\n" +
              "  classes no mechanism can decide, and those should be rare in a healthy tree.\n");
}
