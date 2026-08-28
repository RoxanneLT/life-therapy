/**
 * .claude/hooks/agent-write-scope.js — PreToolUse gate bounding where a SUBAGENT may write.
 *
 * WHY THIS EXISTS: **E8, measured in the sibling project (pleks/docs/EXPERIMENTS.md), not here.**
 * `tools:` frontmatter does NOT withhold Write/Edit from a custom spine on CLI 2.1.235 — the
 * harness appends both to every custom agent regardless of what the frontmatter lists. That is a
 * HARNESS fact, not a project one, so it applies to this repo's six agents identically and did not
 * need re-measuring to be believed. It is also why this gate is not optional here: four spines in
 * `.claude/agents/` describe themselves as read-only, `CLAUDE.md` §7 repeats it, and until this
 * file existed not one of those statements was true. A capability nothing bounds, described in
 * prose as absent, is the exact shape this project keeps paying for.
 *
 * E7 (same source) measured the replacement: PreToolUse stdin carries `agent_id` and `agent_type`
 * on a subagent invocation and carries NEITHER in the main session — confirmed in both directions,
 * so absence is a real signal rather than a field this hook simply never sees. The scope is
 * therefore decided per agent type at the tool call, rather than asserted in a spine and hoped for.
 *
 * THE RULE BEING ENFORCED: agent artefacts go to `.handoff/<task-slug>/` — at the REPO ROOT, and
 * that is a permissions requirement rather than a preference. Claude Code treats a set of paths as
 * protected, `.claude` among them, and a write under one is never auto-approved in any mode a
 * pipeline actually runs in. This hook originally scoped agents to `.claude/handoff/`, which meant
 * every artefact write stalled on a permission prompt BY DESIGN, with no hook or settings rule able
 * to override it — protection is evaluated BEFORE `permissions.allow`, so an `Edit(.claude/**)`
 * entry cannot pre-approve it either. The sibling project paid three days, three restarts and two
 * write-ups of a wrong diagnosis to find this (pleks `docs/EXPERIMENTS.md` E13); the fix is one path
 * segment. Do not tidy this directory back inside `.claude/`.
 *
 * The protected list is ENUMERATED, not exemplary, and reading it as examples is how a second
 * protected path gets picked: `.git`, `.config/git`, `.vscode`, `.idea`, `.husky`, `.cargo`,
 * `.devcontainer`, `.yarn`, `.mvn`, `.claude` (except `.claude/worktrees`), plus ~21 named files.
 * There is no dotfile wildcard, so a repo-root `.handoff/` is clear where `.claude/.handoff/` would
 * not have been. Full statement: `dev-standards/playbooks/4-AGENT-PIPELINES.md` §3.
 *
 * FAIL-CLOSED DIRECTION: an unparseable payload asks rather than allows — same posture as
 * bash-gate.js. A broken gate that stalls is recoverable; one that waves writes through is not.
 */
// @event PreToolUse
// @matcher Write|Edit|MultiEdit|NotebookEdit
// @no-twin settings.json permissions have no agent dimension — a `Write(...)` rule cannot say
// "only when the caller is a subagent", so any twin would either be dormant-and-useless or would
// gate the main session's every edit. The probe suite in scripts/check-agent-write-scope.mjs is the
// backstop instead: if this hook is deleted or stops matching, `npm run check` goes red.
const path = require("node:path");

/**
 * Write scope per agent type. An entry of `null` means unrestricted.
 *
 * The read-only spines get the handoff directory and nothing else — that is their entire legitimate
 * write surface under the pipeline protocol. implementer's whole remit IS editing source, so it is
 * unrestricted; its containment is the rung-1 gate below plus the caller's review, NOT a worktree
 * (E10: a worktree is created from the DEFAULT BRANCH, so on a feature branch the agent transforms a
 * different tree from the caller's and its green check proves nothing about the caller's).
 *
 * crawler-doctrine USED TO CARRY `.claude/crawlers` here, and that entry was wrong twice over.
 * `scripts/crawl.mjs` D3 is explicit — "the agent never writes anything. It emits JSON on stdout;
 * this parses it" — so the grant was never exercised, and `.claude/` is a protected path, so the one
 * time it was exercised it would have stalled. The upstream protocol says the crawler "additionally
 * owns its findings file", which describes a design where the agent writes it; here the wrapper
 * does. An unused grant is not free: it reads as a considered decision and silently covers whatever
 * is written into that path next, which is the stale-exemption failure this project already names.
 *
 * An agent type absent from this table is NOT denied — it is asked. Ad-hoc `general-purpose`
 * delegation is a legitimate thing to do and this hook is not the place to forbid it; but a write
 * from an agent nobody scoped should be visible rather than silent.
 */
const SCOPES = {
  grounder: [".handoff"],
  census: [".handoff"],
  walker: [".handoff"],
  "db-inspector": [".handoff"],
  "crawler-doctrine": [".handoff"],
  implementer: null,
};

/** Resolve a tool's target path, whatever the tool calls the field. */
function targetPath(toolInput) {
  if (!toolInput) return null;
  return toolInput.file_path || toolInput.notebook_path || toolInput.path || null;
}

/** True when `file` sits inside `root`. Case-insensitive on Windows; `..` cannot escape. */
function contains(root, file) {
  const rel = path.relative(root, file);
  if (rel === "") return true;
  if (rel.startsWith("..") || path.isAbsolute(rel)) return false;
  return true;
}

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let decision = "allow";
  let reason = "agent-write-scope: not a subagent write";
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^﻿/, ""));
    const agentType = input.agent_type;

    // No `agent_type` means the main session. E7 confirmed the field is absent there, and confirmed
    // it in BOTH directions (a control ran before and after the treatment) — so absence is a real
    // signal, not a field this hook simply never sees.
    if (agentType) {
      const cwd = input.cwd || process.cwd();
      const raw = targetPath(input.tool_input);
      if (!raw) {
        decision = "ask";
        reason = `agent-write-scope: ${agentType} called ${input.tool_name} with no recognisable path field`;
      } else if (!(agentType in SCOPES)) {
        decision = "ask";
        reason = `agent-write-scope: "${agentType}" has no declared write scope — approve deliberately or add one`;
      } else {
        const allowed = SCOPES[agentType];
        if (allowed !== null) {
          const file = path.resolve(cwd, raw);
          const roots = allowed.map((r) => path.resolve(cwd, r));
          if (!roots.some((root) => contains(root, file))) {
            decision = "deny";
            reason =
              `agent-write-scope: ${agentType} may only write to ${allowed.join(", ")} — ` +
              `"${raw}" is outside it. Artefacts go to .handoff/<task-slug>/; ` +
              `report findings to the caller instead of editing the tree.`;
          } else {
            reason = `agent-write-scope: ${agentType} writing inside its scope`;
          }
        } else {
          reason = `agent-write-scope: ${agentType} has an unrestricted write grant`;
        }
      }
    }
  } catch {
    decision = "ask";
    reason = "agent-write-scope: could not parse hook input — failing to a prompt, not to silence";
  }
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: decision,
        permissionDecisionReason: reason,
      },
    }),
  );
});
