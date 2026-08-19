#!/usr/bin/env node
/**
 * Gate the AUTHORING of a script that runs SQL against production.
 *
 * WHY THIS EXISTS: `bash-gate.js` already asks before a command that contains the Supabase
 * Management API URL. That covers a curl typed at the prompt — and misses the way DDL is
 * actually applied here. The documented pattern for anything needing real credentials is
 * `npx tsx --env-file=.env.local <script>` (ESM hoists imports above dotenv.config(), so a
 * script without it initialises Prisma with no DATABASE_URL). The URL then lives inside the
 * FILE, and the command line is indistinguishable from any other script run.
 *
 * On 2026-08-18 five schema changes reached production that way. Each was individually
 * approved by a human who was asked — but asked about a *file write*, not about DDL. The
 * gate that exists to make production SQL deliberate never fired once.
 *
 * So the question moves to where the statement is written, which is also where a person can
 * still read it. Approving `ALTER TABLE …` in a file you can see beats approving an opaque
 * `npx tsx scratchpad/thing.ts` two steps later.
 *
 * ASK, never deny: this is the working path for schema changes (.claude/rules/schema-changes.md),
 * not a forbidden one. What it must not be is silent.
 *
 * @no-twin The settings layer cannot express this rule. Its permission patterns match on TOOL
 * and PATH — `Write(app/**)`, `Edit(lib/**)` — and this gate's whole question is about CONTENT:
 * does the text being written contain a Management API endpoint AND a DDL keyword. There is no
 * path that identifies a DDL script, because the documented pattern is an ordinary `.ts` file
 * anywhere in the tree. A path-based twin would have to gate every file write in the project,
 * which is a prompt on every edit and would be switched off within an hour.
 *
 * So this gate is genuinely single-layer, and that is a real exposure rather than an oversight:
 * if this file's path breaks, DDL authoring goes unprompted with no backstop, and the failure is
 * silent (`dev-standards/LESSONS.md` L-16). What stands in for a twin is the probe suite —
 * ddl-gate.test.mjs, 16 cases, in `npm run check` — so a broken matcher fails the build even
 * though a broken PATH still would not. Stated because an unstated single point of failure reads
 * as a covered one.
 */
const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let decision = "allow";
  let reason = "ddl-gate: default allow";

  try {
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8").replace(/^﻿/, ""));
    const ti = input?.tool_input ?? {};

    // Everything this write would put on disk. Edit sends new_string, Write sends content,
    // MultiEdit sends an edits array — read all three rather than assuming a tool shape.
    const written = [
      ti.content,
      ti.new_string,
      ...(Array.isArray(ti.edits) ? ti.edits.map((e) => e?.new_string) : []),
    ]
      .filter((s) => typeof s === "string")
      .join("\n");

    // Linear-time patterns only: this runs on every file write in the session.
    const HITS_MANAGEMENT_API = /api\.supabase\.com\/[^\s"'`]*\/database\/query/.test(written);
    // A statement that CHANGES the schema, as opposed to a SELECT against it. Catalog reads
    // and row queries through the same endpoint are routine and stay silent.
    const IS_DDL =
      /\b(?:ALTER|CREATE|DROP|TRUNCATE)\s+(?:TABLE|TYPE|INDEX|POLICY|TRIGGER|FUNCTION|SCHEMA|VIEW|SEQUENCE)\b/i.test(
        written,
      ) || /\bALTER\s+TYPE\b[\s\S]*\bADD\s+VALUE\b/i.test(written);

    if (HITS_MANAGEMENT_API && IS_DDL) {
      decision = "ask";
      reason =
        "ddl-gate: this file applies DDL to PRODUCTION via the Supabase Management API. " +
        "Read the exact statement before approving. Schema changes need explicit instruction " +
        "(CLAUDE.md), must be additive first — add nullable, backfill, then tighten — and must " +
        "be mirrored into schema.prisma by hand afterwards, because `prisma db pull` hangs on " +
        "this project's pooler. See .claude/rules/schema-changes.md.";
    } else if (HITS_MANAGEMENT_API) {
      // A read through the same endpoint. Allowed, but say so, because the difference between
      // this and the branch above is one keyword.
      reason = "ddl-gate: Management API read (no DDL keyword) — allowed";
    }
  } catch {
    decision = "ask";
    reason = "ddl-gate: could not parse hook input — failing to a prompt, not to silence";
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
