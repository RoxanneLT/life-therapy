/**
 * Probes for ddl-gate.js. Run: `node .claude/hooks/ddl-gate.test.mjs`
 *
 * WHY IT DID NOT EXIST UNTIL NOW, which is the uncomfortable part. `bash-gate` has had 17
 * probes since the day it denied its own commit. This gate — the one standing between a
 * script and PRODUCTION DDL — had none, so nothing had ever demonstrated it could fire.
 * It is the worse of the two to leave unproven: bash-gate refuses a command you watch
 * fail, while this fires on a FILE WRITE, so if its matching broke the only symptom would
 * be silence, and silence is exactly the failure it was built for (five schema changes
 * reached production ungated on 2026-08-18).
 *
 * THE FIXTURES ARE ASSEMBLED AT RUNTIME, never written as literals. This gate inspects
 * file writes, so a test file containing `…/database/query` beside an `ALTER TABLE` would
 * trip the gate every time anyone edited it — the probe firing its own subject. The
 * payload piped to the hook is byte-identical either way; only the file on disk is inert.
 * Same principle as bash-gate's fixtures living on disk rather than on a command line: a
 * probe cannot travel through the channel the control inspects
 * (`dev-standards/LESSONS.md` L-20).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "ddl-gate.js");

// Assembled, so this file is inert on disk. See the header.
const API = "https://api.supabase.com/v1/projects/" + "abc123" + "/database" + "/query";
const ALTER = "ALTER " + "TABLE bookings ADD COLUMN foo text";
const SELECT = "SELECT " + "id FROM bookings LIMIT 1";

function decide(toolInput) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: "utf8",
  });
  if (r.error) return `spawn-error:${r.error.message}`;
  try {
    return JSON.parse(r.stdout || "{}").hookSpecificOutput?.permissionDecision ?? "(none)";
  } catch {
    return `unparseable:${(r.stdout || "").slice(0, 60)}`;
  }
}

const CASES = [
  // ── must ASK: DDL heading for production ────────────────────────────────────
  ["Write: content carries the API and an ALTER", { content: `const q = "${ALTER}"; fetch("${API}")` }, "ask"],
  ["Edit: new_string carries both", { new_string: `fetch("${API}", { body: '${ALTER}' })` }, "ask"],
  // The tool shape the gate reads explicitly — an edits ARRAY, not a single string.
  ["MultiEdit: a single edit carries both", { edits: [{ new_string: `${API} ${ALTER}` }] }, "ask"],
  // Split across two edits. They are joined before matching, which is the point: a DDL
  // statement and its endpoint arriving in separate hunks of one write is still one write.
  ["MultiEdit: URL in one edit, DDL in another", { edits: [{ new_string: API }, { new_string: ALTER }] }, "ask"],
  ["lowercase ddl still matches", { content: `${API} alter table bookings add column x int` }, "ask"],
  ["CREATE INDEX", { content: `${API} CREATE INDEX idx_foo ON bookings(id)` }, "ask"],
  ["DROP TABLE", { content: `${API} DROP TABLE scratch` }, "ask"],
  ["TRUNCATE TABLE", { content: `${API} TRUNCATE TABLE rate_limits` }, "ask"],
  // The enum case, special-cased because `ALTER TYPE … ADD VALUE` does not match the
  // generic object-keyword pattern.
  ["ALTER TYPE … ADD VALUE", { content: `${API}\nALTER TYPE session_status ADD VALUE 'paused'` }, "ask"],

  // ── must ALLOW: the negative space, and the half that matters more ──────────
  // A read through the same endpoint is routine and must stay quiet. If this asked, the
  // gate would fire on ordinary work and get switched off.
  ["the API with only a SELECT", { content: `fetch("${API}", { body: '${SELECT}' })` }, "allow"],
  // DDL with no endpoint: a migration note, a comment, a schema file. Not this gate's job.
  ["DDL text with no API URL", { content: `-- ${ALTER}\n-- documented in schema-changes.md` }, "allow"],
  ["prose mentioning both concepts but no URL", { content: "We should alter the table layout of the invoice page." }, "allow"],
  ["an ordinary file write", { content: "export const x = 1;\n" }, "allow"],
  ["empty content", { content: "" }, "allow"],
  ["no tool_input fields at all", {}, "allow"],
];

let failed = 0;
for (const [name, input, want] of CASES) {
  const got = decide(input);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${want.padEnd(5)} got=${String(got).padEnd(7)} ${name}`);
}

// Malformed input must fail to a PROMPT, never to silence — the one outcome a gate may
// not have. Probed directly because it is the branch a crash would take.
const r = spawnSync(process.execPath, [HOOK], { input: "{not json", encoding: "utf8" });
const onGarbage = (() => {
  try {
    return JSON.parse(r.stdout || "{}").hookSpecificOutput?.permissionDecision;
  } catch {
    return "(unparseable output)";
  }
})();
const garbageOk = onGarbage === "ask";
if (!garbageOk) failed++;
console.log(`  ${garbageOk ? "✓" : "✗"} ask   got=${String(onGarbage).padEnd(7)} unparseable hook input fails to a prompt`);

console.log(
  failed === 0
    ? `\nddl-gate: ${CASES.length + 1} probes, all pass ✓`
    : `\nddl-gate: ${failed} of ${CASES.length + 1} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
