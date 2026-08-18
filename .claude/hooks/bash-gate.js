/**
 * .claude/hooks/bash-gate.js — PreToolUse gate for Bash
 *
 * WHY THIS EXISTS: allow-rules cannot cover commands containing $() command substitution or
 * multiline/awk/heredoc bodies — Claude Code's injection analysis decomposes them and prompts
 * regardless of any allow rule, which stalls long sessions on trivial greps. A PreToolUse hook
 * decides BEFORE the permission system: "allow" skips the prompt; "ask"/"deny" force the gate.
 *
 * Posture: allow everything EXCEPT the named gates below.
 *
 * MEASURED 2026-08-18, and it corrects what this comment used to claim: a hook "allow" does NOT
 * leave settings.json free to intervene. `Bash(curl*)` sits in permissions.ask, and a bare curl —
 * which this hook allows, since its rule only matches the Management API URL — ran with no prompt
 * at all. The hook short-circuits the permission system entirely. These are NOT belt-and-braces
 * while the hook is alive.
 *
 * That does not break the @twin design below; it explains it. A twin is DORMANT BY DESIGN while
 * this file runs, and matters only in the one scenario it exists for — this hook dead, its script
 * path broken, its failure reported as a non-blocking status nobody reads. Then settings is all
 * there is.
 *
 * Consequence for testing: a twin cannot be probed while the hook is alive, because the hook
 * answers first. Verifying one means disabling this hook and re-running the command — which is
 * also a faithful rehearsal of the only situation the twin covers.
 *
 * The push gate is not a nicety — the standing rule on this project is that Stéan walks and
 * visually checks the work before it goes out. Claude never pushes on its own initiative.
 */
/**
 * Blank out heredoc BODIES before gating. A body is data on stdin, not a command
 * position — `git commit -F - <<'EOF' … EOF` legitimately carries prose that names
 * gated commands.
 *
 * The scar at CMD below records this being fixed once, for the INLINE case. It was
 * not enough: `\n` is one of the separators CMD treats as a command boundary, so a
 * commit message that merely wraps such that "prisma migrate" lands at the start of
 * a line reads as a command. That denied this very file's commit describing the
 * rule — the same bug, in the same gate, through the door the first fix left open.
 *
 * THE HOLE TO AVOID: a heredoc fed to a SHELL is executed. `bash <<'EOF' … EOF`
 * runs its body. So the body is stripped only when the command receiving it is not
 * an interpreter — otherwise the gate would blind itself to the one heredoc that is
 * genuinely a command.
 *
 * Linear-time by construction: one forward scan, no nested quantifiers, and the
 * terminator pattern is built from a matched identifier, never from free text.
 */
function stripHeredocBodies(s) {
  const OPEN = /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g;
  const INTERPRETER = /(?:^|[;&|\n]\s*)\s*(?:sudo\s+)?(?:ba|z|k|da)?sh\b|(?:^|[;&|\n]\s*)\s*eval\b/;
  let out = "";
  let last = 0;
  let m;
  while ((m = OPEN.exec(s)) !== null) {
    // Is the command that OWNS this heredoc a shell? Look back to the last separator.
    const lineStart = Math.max(0, s.lastIndexOf("\n", m.index), s.lastIndexOf(";", m.index));
    if (INTERPRETER.test("\n" + s.slice(lineStart, m.index))) continue;

    const bodyStart = s.indexOf("\n", m.index + m[0].length);
    if (bodyStart === -1) break;
    const rest = s.slice(bodyStart + 1);
    const end = new RegExp(`^[ \\t]*${m[2]}[ \\t]*$`, "m").exec(rest);
    const bodyEnd = end ? bodyStart + 1 + end.index + end[0].length : s.length;

    out += s.slice(last, m.index + m[0].length) + "\n<<heredoc body stripped>>\n";
    last = bodyEnd;
    OPEN.lastIndex = bodyEnd;
  }
  return out + s.slice(last);
}

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let decision = "allow";
  let reason = "bash-gate: default allow";
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^﻿/, ""));
    const cmd = stripHeredocBodies(input?.tool_input?.command || "");

    // Every pattern here must be linear-time. This hook runs on EVERY Bash call, so a regex
    // that backtracks would hang the session rather than merely mis-gate a command.
    //
    // CMD anchors a pattern to a COMMAND POSITION — start of input, or after a shell
    // separator (; && || | newline). Without it, the prisma rule below matched the words
    // "prisma migrate" inside a `git commit` heredoc and denied a commit whose only sin was
    // *describing* the rule. A gate that fires on prose is a gate people rip out.
    const CMD = String.raw`(?:^|[;&|\n]\s*|\$\(\s*)\s*(?:npx\s+|pnpm\s+|yarn\s+|npm\s+run\s+)?`;
    const cmdRe = (body) => new RegExp(CMD + body);

    // Each incident-class rule names its settings.json TWIN. The twin exists for one
    // scenario only: this hook is dead. A hook whose script path breaks reports a
    // non-blocking status nobody reads, and every rule held here alone degrades without
    // failing — deny silently becomes ask, ask silently becomes allow.
    //
    // The pairing is deliberately ASYMMETRIC, and equal-or-stronger would be wrong.
    // settings.json speaks in prefix-globs; this file speaks in separator-aware regex.
    // A coarse DENY in the dumb layer false-positives forever and cannot be taught
    // better — see the heredoc scar at the top of this file. A coarse ASK puts a human
    // in the loop exactly when the smart layer is gone, and costs only an occasional
    // prompt while it is alive. Ask is the floor. Absent is the violation.
    //
    // Reconciled by `hooks: every incident-class gate has a settings twin`. If a twin
    // prompts too often, NARROW its pattern — never delete it.
    const DENY = [
      // @twin Bash(git push --force*)
      [cmdRe(String.raw`git\s+push\s+[^\n]*(?:--force|-f\b)`), "force push is denied"],
      // @twin Bash(git reset --hard*)
      [cmdRe(String.raw`git\s+reset\s+--hard`), "hard reset is denied"],
      // @twin Bash(rm -rf /*)
      // Narrowed from a bare `rm -rf*`, which would have prompted on every scratch-dir
      // cleanup. The dangerous shapes are the rooted ones; the quoted and trailing-space
      // variants stay this layer's job.
      [/rm\s+-[rf]{1,2}\s+["']?[/~]["']?(\s|$)/, "rm -rf on root/home is denied"],
      // Prisma's migration engine has never worked against this Supabase instance: DATABASE_URL is
      // the pgbouncer pooler (:6543), and migrate needs a direct connection for its shadow DB and
      // advisory locks. Denied rather than gated, so nobody burns a session rediscovering it.
      // Schema changes go through the Supabase Management API — see .claude/rules/schema-changes.md.
      // @twin Bash(npx prisma migrate*)
      [
        cmdRe(String.raw`prisma\s+(?:migrate|db\s+push)`),
        "prisma migrate/db push does NOT work on this project — apply DDL via the Supabase Management API, then `npx prisma db pull && npx prisma generate` (see .claude/rules/schema-changes.md)",
      ],
    ];
    const ASK = [
      // @twin Bash(git push*)
      [cmdRe(String.raw`git\s+push\b`), "pushing to origin requires approval — the user walks the work first"],
      // The Management API is the working path for DDL — but it hits PRODUCTION.
      // @twin Bash(curl*)
      // The twin is coarser than it looks necessary, on purpose: settings.json cannot
      // match a URL mid-command, so the only reliable floor is the tool that carries it.
      // curl is rare here and its two documented uses (this, and triggering a cron by
      // hand with a live CRON_SECRET) both deserve a prompt anyway.
      [/api\.supabase\.com\/\S*\/database\/query/, "this runs SQL against production — approve the statement"],
      // @twin Bash(vercel*)
      [/\bvercel\b/, "deploying requires approval"],
    ];

    for (const [re, why] of DENY) {
      if (re.test(cmd)) { decision = "deny"; reason = "bash-gate: " + why; break; }
    }
    if (decision === "allow") {
      for (const [re, why] of ASK) {
        if (re.test(cmd)) { decision = "ask"; reason = "bash-gate: " + why; break; }
      }
    }
    // .env handling, kept out of the tables because it needs a two-step decision.
    // Loading a .env is routine — `npx tsx --env-file=.env.local` is the documented way to run
    // scripts here (ESM hoists imports above dotenv.config(), so Prisma would otherwise init with
    // no DATABASE_URL). Prompting on that every time would train the user to click through the
    // prompt that actually matters. What we gate is a command that could print the file's contents.
    if (decision === "allow" && /\.env\b/.test(cmd)) {
      const pipedOut = /\.env\S*\s*[|>]/.test(cmd);
      const loadsEnvOnly = /--env-file[=\s]\S+/.test(cmd) && !pipedOut;
      const readsItOut =
        pipedOut || /\b(cat|less|more|head|tail|grep|rg|strings|xxd|od|cp|mv|scp)\b/.test(cmd);
      if (readsItOut && !loadsEnvOnly) {
        decision = "ask";
        reason = "bash-gate: reading out a .env file requires approval";
      }
    }
  } catch {
    decision = "ask";
    reason = "bash-gate: could not parse hook input — failing to a prompt, not to silence";
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
});
