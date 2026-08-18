/**
 * Probes for bash-gate.js. Run: `node .claude/hooks/bash-gate.test.mjs`
 *
 * WHY THIS IS A FILE. The fixtures name the very commands the gate blocks, so
 * passing them on a command line gets the attempt itself denied — `&& npx prisma
 * db push` inside a test invocation is a real command position, and the gate is
 * right to fire on it. A gate's probes cannot travel through the channel the gate
 * inspects. They have to live on disk and be read.
 *
 * WHY IT EXISTS AT ALL. A hook is the one control that reaches every context —
 * subagents included — and the one whose failure is silent: break its path and
 * Claude Code reports a non-blocking status nobody reads, after which every rule
 * it holds degrades without anything going red (LESSONS L-006). Planting a
 * violation and watching a check fail is the standing discipline here (L-002);
 * this is that discipline pointed at the gate itself.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "bash-gate.js");

function decide(command) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: "utf8",
  });
  if (r.error) return `spawn-error:${r.error.message}`;
  try {
    const o = JSON.parse(r.stdout || "{}");
    return o.hookSpecificOutput?.permissionDecision ?? o.permissionDecision ?? "(none)";
  } catch {
    return `unparseable:${(r.stdout || "").slice(0, 60)}`;
  }
}

const P = "prisma"; // split so this file's own fixtures read as data, not instruction

const CASES = [
  // The regression that prompted the heredoc strip: a commit message that merely
  // DESCRIBES a gated command, wrapped so the words land at the start of a line.
  // `\n` is one of the separators CMD treats as a command boundary, so the first
  // (inline-only) fix did not cover this.
  ["heredoc prose naming a gated command", `git commit -F - <<'EOF'\nfix: something\n\n${P} migrate is blocked on this project\nEOF`, "allow"],
  ["heredoc prose, force push", `git commit -F - <<'EOF'\nnote: git push --force is denied\nEOF`, "allow"],

  // The hole the strip must NOT open: a heredoc fed to a SHELL is executed.
  ["shell heredoc actually running it", `bash <<'EOF'\nnpx ${P} migrate dev\nEOF`, "deny"],
  ["sh heredoc actually running it", `sh <<'EOF'\nnpx ${P} db push\nEOF`, "deny"],

  // The gates themselves, still firing.
  [`${P} migrate, plainly`, `npx ${P} migrate dev`, "deny"],
  [`${P} db push after a separator`, `echo hi && npx ${P} db push`, "deny"],
  ["force push", "git push --force origin master", "deny"],
  ["force push, short flag", "git push -f", "deny"],
  ["hard reset", "git reset --hard HEAD~1", "deny"],
  ["rm -rf on root", 'rm -rf /', "deny"],
  ["rm -rf on home", "rm -rf ~", "deny"],
  ["production SQL through the Management API", 'curl -X POST "https://api.supabase.com/v1/projects/abc/database/query" -d @q.json', "ask"],
  ["deploy", "vercel --prod", "ask"],
  ["push", "git push origin master", "ask"],

  // Must stay out of the way. A gate that fires on ordinary work gets ripped out.
  ["ordinary check", "npm run check", "allow"],
  ["scratch cleanup", "rm -rf ./scratch-q", "allow"],
  ["a grep with command substitution", 'grep -rn "$(echo pattern)" lib/', "allow"],
];

let failed = 0;
for (const [name, command, want] of CASES) {
  const got = decide(command);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? "✓" : "✗"} ${want.padEnd(5)} got=${String(got).padEnd(7)} ${name}`);
}

console.log(
  failed === 0
    ? `\nbash-gate: ${CASES.length} probes, all pass ✓`
    : `\nbash-gate: ${failed} of ${CASES.length} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);
