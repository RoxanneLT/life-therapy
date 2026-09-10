#!/usr/bin/env node
/**
 * scripts/check-hook-registration.mjs — a hook file is not a hook until settings wires it.
 *
 * @kit check-hook-registration v4 — tracked. Edit it in dev-standards and re-adopt; a local
 * change here is a fork, and `check-kit-drift.mjs` will say so.
 *
 * WHAT IT CATCHES. Delete the `hooks` block from `.claude/settings.json` and every gate goes inert
 * while the hook files, their probe suites and any `@enforced hook:` tag that resolves by file
 * PRESENCE all stay green. A probe suite spawns each hook file directly, which is the right way to
 * test its LOGIC and no way at all to test whether anything invokes it — dev-standards L-06, one
 * layer out from where L-06 was first written. Running a denied command and reading the denial back
 * is the right instinct and not a control: a manual proof lasts one session, and the next session
 * inherits a claim instead of a mechanism.
 *
 * THE TWIN HALF: each hook declares `// @twin <settings pattern>` beside the rule it implements, or
 * `// @no-twin <reason>` where the settings layer cannot express the question. The audit takes the
 * set difference against `permissions.deny ∪ ask`. Deliberately NOT equal-or-stronger — settings
 * speaks in prefix-globs and a hook in separator-aware regex, so **ask is the floor; absent is the
 * violation**.
 *
 * Two traps, both avoided here: the markers live in COMMENTS, so a comment-stripping read erases
 * them; and matching `@twin` anywhere swallows prose ABOUT the markers, so the match is anchored to
 * a dedicated comment line.
 *
 * Where it came from is the MANIFEST row's `why` in dev-standards. These bytes are copied into
 * every adopter, so they say what the code does and nothing about where it was first run.
 *
 * Run: node scripts/check-hook-registration.mjs             (wired into `npm run check`)
 *      node scripts/check-hook-registration.mjs --selftest  (probes both directions)
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const HOOK_DIR = ".claude/hooks";
const SETTINGS = ".claude/settings.json";

/**
 * A dedicated `// @<tag> <value>` comment line. Anchored: prose about twins is not a twin.
 *
 * Read ONE LINE AT A TIME since v4. As whole-file `/m` patterns, `\s` could cross a newline: `^\s*`
 * restarted at every line of a blank run (quadratic, which pleks's lint found), and `\s+` after the
 * tag reached the NEXT line, so a bare `// @twin` took whatever followed it as its pattern.
 */
const TWIN = /^\s*\/\/\s*@twin\s+(\S.*)$/;
const NO_TWIN = /^\s*\/\/\s*@no-twin\s+(\S.*)$/;
const EVENT = /^\s*\/\/\s*@event\s+(\S+)/;
const MATCHER = /^\s*\/\/\s*@matcher\s+(\S.*)$/;
const NON_BLOCKING = /^\s*\/\/\s*@non-blocking\s+(\S.*)$/;

/** Every value `re` declares in `src`, in file order, trailing whitespace trimmed. */
export function directives(src, re) {
  return src.split(/\r\n?|\n/).map((l) => re.exec(l)?.[1].trimEnd()).filter((v) => v !== undefined);
}

/** A path with everything through its LAST `hooks` directory removed — the file under it. */
const underHooks = (p) => {
  const i = p.replaceAll("\\", "/").lastIndexOf("/hooks/");
  return i === -1 ? p : p.slice(i + "/hooks/".length);
};

/**
 * The hook file a command names, read as v3's `([\w./\\$-]*\.claude[/\\]hooks[/\\][\w.-]+\.js)`
 * read it: the first path-shaped word holding a `.claude/hooks/<name>.js`, the LAST such in that
 * word, and the name up to its last `.js`. Scanned rather than matched: the class in front
 * of `\.claude` also holds `.`, so that pattern backtracked from every start position.
 */
export function namedHookFile(cmd) {
  const AT = /\.claude[/\\]hooks[/\\]([\w.-]+)/y;
  for (const word of cmd.match(/[\w./\\$-]+/g) ?? []) {
    let file = null;
    for (let i = word.indexOf(".claude"); i !== -1; i = word.indexOf(".claude", i + 1)) {
      AT.lastIndex = i;
      const m = AT.exec(word);
      const js = m ? m[1].lastIndexOf(".js") : -1;
      if (js >= 1) file = m[1].slice(0, js + 3);
    }
    if (file) return file;
  }
  return null;
}

/**
 * THE SHIPPED PLACEHOLDER IS NOT A REASON.
 *
 * Found 2026-09-09 by the first end-to-end greenfield walk. `bash-gate.js` ships its twins region
 * pre-filled with an instruction to fill it in:
 *
 *   // @no-twin Replace with this project's twins, or state why the gates below have none.
 *
 * That satisfied this check exactly as a real reason would, so a project that installed the kit and
 * configured nothing reported `every hook is registered in settings, declares its twin, and its
 * twins are present`. The "reason" was the sentence telling you to write a reason.
 *
 * `check-handoff-contract` already probes this class one directory away — "an UNFILLED template
 * echoed back fires: it passes every label test and is still not a report" — and the doctrine never
 * reached its sibling. That is the L-63 shape: the artefact propagated, the mechanism that verifies
 * it did not.
 *
 * The patterns are deliberately about the SHAPE of an unfilled field rather than a list of canon's
 * exact strings. Canon's own placeholder must be caught, but so must the hand-written stub that
 * replaces it five minutes later, and a project cannot be expected to know canon's wording.
 */
const PLACEHOLDER = [
  /^replace\b/i,
  /^todo\b/i,
  /^tbd\b/i,
  /^fixme\b/i,
  /^e\.g\./i,
  /^<.*>$/,
  /\bstate why\b/i,
  /\byour reason here\b/i,
];

/** Is this @no-twin reason an unfilled field wearing a reason's clothes? */
export function isPlaceholderReason(reason) {
  const r = String(reason ?? "").trim();
  return r.length === 0 || PLACEHOLDER.some((re) => re.test(r));
}

/**
 * Claude Code's hook events. Anything else is a typo or an invention, and either way the block is
 * inert — settings does not validate event names, so `PreToolUsee` is silently ignored.
 */
const KNOWN_EVENTS = new Set([
  "PreToolUse", "PostToolUse", "UserPromptSubmit", "Notification",
  "Stop", "SubagentStop", "PreCompact", "SessionStart", "SessionEnd",
]);
/** Only PreToolUse can refuse a call. A gate registered anywhere else cannot block. */
const BLOCKING_EVENTS = new Set(["PreToolUse"]);
/** The events whose entries are scoped by a `matcher`. The rest have no tool to match. */
const MATCHED_EVENTS = new Set(["PreToolUse", "PostToolUse"]);

/**
 * Registrations that actually invoke a hook FILE, with the event and matcher they carry.
 *
 * The upstream first version returned bare command strings and matched them with
 * `c.includes(filename)`. Adversarial review found that green on SEVEN distinct ways a hook can be
 * unwired: a misspelled event, an invented event, registration under PostToolUse (runs after the
 * call — cannot block), a matcher that never sees the tool, the filename appearing inside an `echo`
 * string, a command pointing at a COPY of the file outside `.claude/hooks`, and an entry missing
 * `type: "command"`. A substring test on a filename is not a registration check.
 */
export function registrations(settings) {
  const out = [];
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    for (const entry of entries ?? []) {
      for (const h of entry.hooks ?? []) {
        if (h.type !== "command" || typeof h.command !== "string") continue;
        // The command must EXECUTE a file under .claude/hooks — not merely mention one.
        const m = h.command.match(
          /(?:^|\s)(?:node|npx|sh|bash)\s+["']?([^"'\s]*[/\\]\.claude[/\\]hooks[/\\][\w.-]+\.js)["']?/,
        );
        if (!m) continue;
        out.push({ event, matcher: entry.matcher, file: underHooks(m[1]), command: h.command });
      }
    }
  }
  return out;
}

/**
 * Three further failures, each of which looks complete from a different angle:
 *
 *   hook file not registered     → the control never runs, and every artefact says it exists
 *   registration → missing file  → a non-blocking error nobody reads
 *   registration with no matcher → a scope nobody chose
 *
 * The middle one is why a renamed hook file is dangerous: disabling a gate by renaming its file is
 * a normal thing to do during an experiment, and nothing would catch a failure to restore it.
 */
export function registrationFindings(settings, root, existsFn) {
  const out = [];
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    for (const entry of entries ?? []) {
      // Only the tool-scoped events take a matcher. Demanding one on SessionStart/Stop would be a
      // false positive on a correct config, and a check that cries wolf on the good case is how a
      // real finding gets waved through.
      if (MATCHED_EVENTS.has(event) && (!entry.matcher || String(entry.matcher).trim() === "")) {
        out.push(`${SETTINGS}: a ${event} entry has no matcher — it declares a scope nobody chose`);
      }
      for (const h of entry.hooks ?? []) {
        const file = namedHookFile(typeof h.command === "string" ? h.command : "");
        if (!file) continue;
        if (!existsFn(join(root, HOOK_DIR, file))) {
          out.push(`${SETTINGS}: ${event} registers ${file}, which does not exist in ${HOOK_DIR} — the registration resolves to nothing`);
        }
      }
    }
  }
  return out;
}

export function audit(root = ".") {
  const out = [];
  const hookDir = join(root, HOOK_DIR);
  const settingsPath = join(root, SETTINGS);

  if (!existsSync(settingsPath)) return [`${SETTINGS} is missing — no hook can be registered, so every hook: tag is a claim with no mechanism`];
  if (!existsSync(hookDir)) return [`${HOOK_DIR} is missing — nothing to reconcile`];

  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  const regs = registrations(settings);
  const gated = new Set([...(settings.permissions?.deny ?? []), ...(settings.permissions?.ask ?? [])]);

  // Unknown event names are inert, and settings will not tell you.
  for (const event of Object.keys(settings.hooks ?? {})) {
    if (!KNOWN_EVENTS.has(event)) {
      out.push(`${SETTINGS}: hooks.${event} is not a Claude Code event — the whole block is inert and nothing reports it`);
    }
  }

  out.push(...registrationFindings(settings, root, existsSync));

  // `.probe.mjs` files live beside the hooks; only `.js` files are hooks.
  const hooks = readdirSync(hookDir).filter((f) => f.endsWith(".js"));
  // The enumeration asserts itself: zero hooks with tags claiming otherwise is not a pass.
  if (hooks.length === 0) out.push(`${HOOK_DIR} contains no .js hooks — the enumeration is empty, which is not a pass`);

  for (const f of hooks) {
    const src = readFileSync(join(hookDir, f), "utf8");

    // 1 — REGISTRATION, and what it is registered AS. A gate that runs after the call, or under a
    //     matcher that never sees its tool, is registered and still cannot stop anything.
    const mine = regs.filter((r) => r.file === f);
    if (mine.length === 0) {
      out.push(`${HOOK_DIR}/${f}: no ${SETTINGS} entry EXECUTES it — the file exists and nothing invokes it`);
    } else {
      const wantEvent = directives(src, EVENT)[0];
      const wantMatcher = directives(src, MATCHER)[0];
      if (!wantEvent || !wantMatcher) {
        out.push(`${HOOK_DIR}/${f}: declares no "// @event <Event>" and "// @matcher <pattern>" — without them nothing can check it is registered for the calls it gates`);
      } else {
        if (!mine.some((r) => r.event === wantEvent)) {
          out.push(`${HOOK_DIR}/${f}: declares @event ${wantEvent} but is registered under ${[...new Set(mine.map((r) => r.event))].join(", ")}`);
        }
        if (!mine.some((r) => r.matcher === wantMatcher)) {
          out.push(`${HOOK_DIR}/${f}: declares @matcher ${wantMatcher} but is registered with ${mine.map((r) => JSON.stringify(r.matcher)).join(", ")} — a matcher that never sees its tool is a gate that cannot fire`);
        }
        // A hook on a non-blocking event cannot refuse anything. That is a defect for a GATE and
        // correct for an ANNOTATOR, so the file declares which it is: `// @non-blocking <why>`.
        const nonBlocking = directives(src, NON_BLOCKING)[0];
        for (const r of mine) {
          if (!BLOCKING_EVENTS.has(r.event) && !nonBlocking) {
            out.push(`${HOOK_DIR}/${f}: registered under ${r.event}, which cannot refuse a call — only PreToolUse blocks. If that is deliberate, declare "// @non-blocking <why>".`);
          }
        }
      }
    }

    // 2 — TWIN DECLARATION.
    const twins = directives(src, TWIN);
    const noTwin = directives(src, NO_TWIN)[0];
    if (twins.length === 0 && noTwin === undefined) {
      out.push(`${HOOK_DIR}/${f}: declares neither a settings twin nor @no-twin with a reason — add "// @twin <settings pattern>" per rule, or "// @no-twin <why settings cannot express it>"`);
    } else if (noTwin !== undefined && isPlaceholderReason(noTwin)) {
      out.push(`${HOOK_DIR}/${f}: its @no-twin reason is the kit's unfilled placeholder — "${noTwin}". A project that installed and configured nothing reads as configured, which is worse than reading as unconfigured`);
    }

    // 3 — TWIN RECONCILIATION. Ask is the floor; absent is the violation.
    for (const t of twins) {
      if (!gated.has(t)) {
        out.push(`${HOOK_DIR}/${f}: declares @twin ${t}, which is in neither permissions.deny nor permissions.ask — the dormant layer has nothing to fall back to`);
      }
    }
  }
  return out;
}

/** True only when THIS file is the process entrypoint — not when another script imports it. */
const isEntry = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (isEntry && process.argv.includes("--selftest")) {
  let failed = 0;
  const ok = (c, l) => {
    if (!c) failed++;
    console.log(`  ${c ? "✓" : "✗"} ${l}`);
  };

  ok(registrations({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: 'node "$D/.claude/hooks/g.js"' }] }] } }).length === 1,
    "registrations finds a PreToolUse command that EXECUTES a hook file");
  ok(registrations({}).length === 0, "…and returns nothing when there are no hooks at all");
  ok(registrations({ hooks: { PreToolUse: [] } }).length === 0, "…or when the event list is empty");

  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const tmp = mkdtempSync(join(tmpdir(), "hookreg-"));
  mkdirSync(join(tmp, ".claude", "hooks"), { recursive: true });

  // The fixture hook is a CORRECT hook: it declares the event and matcher it needs and names its
  // settings twin. Every case below unwires exactly one thing, so a finding is attributable.
  const GOOD_HOOK = "// @event PreToolUse\n// @matcher Bash\n// @twin Bash(git push:*main*)\n";
  const ASK = { ask: ["Bash(git push:*main*)"] };
  const RUNS = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/g.js"';
  const entry = (matcher, command = RUNS, type = "command") => ({ matcher, hooks: [{ type, command }] });
  const write = (settings, hookSrc = GOOD_HOOK) => {
    writeFileSync(join(tmp, ".claude", "hooks", "g.js"), hookSrc);
    writeFileSync(join(tmp, ".claude", "settings.json"), JSON.stringify(settings));
  };
  const fires = (settings, needle, label, hookSrc) => {
    write(settings, hookSrc);
    const f = audit(tmp);
    ok(f.some((x) => x.includes(needle)), `${label}${f.some((x) => x.includes(needle)) ? "" : `\n      got: ${JSON.stringify(f)}`}`);
  };
  const clean = (settings, label, hookSrc) => {
    write(settings, hookSrc);
    const f = audit(tmp);
    ok(f.length === 0, `${label}${f.length ? `\n      got: ${JSON.stringify(f)}` : ""}`);
  };

  clean({ permissions: ASK, hooks: { PreToolUse: [entry("Bash")] } },
    "KNOWN-GOOD: registered under the declared event and matcher, twin present in settings");

  // ── The seven ways a hook can be unwired while every artefact still says it exists ────────────
  fires({ permissions: ASK }, "nothing invokes it",
    "1/7 the hooks block is deleted outright — the walker's exact scenario");
  fires({ permissions: ASK, hooks: { PreToolUsee: [entry("Bash")] } }, "is not a Claude Code event",
    "2/7 a MISSPELLED event name — settings does not validate these, so the block is silently inert");
  fires({ permissions: ASK, hooks: { OnBashCommand: [entry("Bash")] } }, "is not a Claude Code event",
    "3/7 an INVENTED event name — same silence, different origin");
  fires({ permissions: ASK, hooks: { PostToolUse: [entry("Bash")] } }, "cannot refuse a call",
    "4/7 registered under PostToolUse — it runs AFTER the call it was written to block");

  // …and the legitimate case it must not swallow.
  clean({ permissions: ASK, hooks: { UserPromptSubmit: [entry("Bash")] } },
    "KNOWN-GOOD: a declared @non-blocking annotator on a non-blocking event",
    "// @event UserPromptSubmit\n// @matcher Bash\n// @non-blocking it annotates, it does not gate\n// @twin Bash(git push:*main*)\n");
  fires({ permissions: ASK, hooks: { UserPromptSubmit: [entry("Bash")] } }, "cannot refuse a call",
    "…and the SAME registration with no @non-blocking still fires",
    "// @event UserPromptSubmit\n// @matcher Bash\n// @twin Bash(git push:*main*)\n");

  fires({ permissions: ASK, hooks: { PreToolUse: [entry("Read")] } }, "a matcher that never sees its tool",
    "5/7 a matcher scoped to the wrong tool — registered, and it never fires");
  fires({ permissions: ASK, hooks: { PreToolUse: [entry("Bash", 'echo "see .claude/hooks/g.js"')] } }, "nothing invokes it",
    "6/7 the filename appears inside an echo STRING — mentioned, not executed");
  fires({ permissions: ASK, hooks: { PreToolUse: [entry("Bash", 'node "$D/scripts/copies/g.js"')] } }, "nothing invokes it",
    "7/7 the command runs a COPY outside .claude/hooks — the tracked file is inert");
  fires({ permissions: ASK, hooks: { PreToolUse: [entry("Bash", RUNS, "prompt")] } }, "nothing invokes it",
    '…and an entry whose type is not "command" never runs anything');

  // ── The declarations themselves ──────────────────────────────────────────────────────────────
  fires({ permissions: ASK, hooks: { PreToolUse: [entry("Bash")] } }, "declares no",
    "a hook with no @event/@matcher cannot be checked against its registration — that is a finding",
    "// @twin Bash(git push:*main*)\n");
  fires({ permissions: {}, hooks: { PreToolUse: [entry("Bash")] } }, "neither permissions.deny nor permissions.ask",
    "a declared twin missing from settings fires");
  fires({ permissions: ASK, hooks: { PreToolUse: [entry("Bash")] } }, "neither a settings twin nor @no-twin",
    "a hook declaring no twin and no @no-twin fires",
    "// @event PreToolUse\n// @matcher Bash\n");
  clean({ permissions: {}, hooks: { PreToolUse: [entry("Bash")] } },
    "KNOWN-GOOD: @no-twin with a reason satisfies the declaration",
    "// @event PreToolUse\n// @matcher Bash\n// @no-twin settings match tool+path; this gate asks about content\n");

  // Prose ABOUT the markers must not be read as a marker — LT recorded this exact false positive,
  // and this project's own bash-gate.js has a paragraph explaining why three rules have no twin.
  clean({ permissions: {}, hooks: { PreToolUse: [entry("Bash")] } },
    "prose mentioning @twin is not parsed as a twin declaration",
    "/**\n * That does not break the @twin design below; it explains it.\n */\n// @event PreToolUse\n// @matcher Bash\n// @no-twin content-shaped question\n");

  const yes = () => true, no = () => false;
  ok(registrationFindings({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ command: 'node ".claude/hooks/g.js"' }] }] } }, ".", yes).length === 0,
    "KNOWN-GOOD: a matcher and a file that exists");
  ok(registrationFindings({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ command: 'node ".claude/hooks/gone.js"' }] }] } }, ".", no)
    .some((x) => x.includes("does not exist")),
    "a registration pointing at a MISSING file fires — the renamed-hook case");
  ok(registrationFindings({ hooks: { PreToolUse: [{ hooks: [{ command: 'node ".claude/hooks/g.js"' }] }] } }, ".", yes)
    .some((x) => x.includes("no matcher")),
    "a registration with NO MATCHER fires — a scope nobody chose");
  ok(registrationFindings({ hooks: { SessionStart: [{ hooks: [{ command: 'node ".claude/hooks/g.js"' }] }] } }, ".", yes).length === 0,
    "KNOWN-GOOD: a matcher-less SessionStart entry is not a finding — that event takes no matcher");

  rmSync(tmp, { recursive: true, force: true });

  // ── v4: directives are read one line at a time ──────────────────────────────────────────
  // v3's `\s+` after the tag could cross a newline, so an EMPTY `// @twin` took the next line's
  // text as its pattern and reconciled a twin nobody declared.
  ok(directives("// @twin\nBash(git push:*)\n", /^\s*\/\/\s*@twin\s+(\S.*)$/).length === 0,
    "a bare `// @twin` does not borrow the next line as its pattern (v3 did)");
  ok(directives("// @matcher\n\nBash\n", /^\s*\/\/\s*@matcher\s+(\S.*)$/).length === 0,
    "…nor does a bare `// @matcher`, across a blank line");
  ok(JSON.stringify(directives("// @twin  A  \r\n  // @twin B\r\n", /^\s*\/\/\s*@twin\s+(\S.*)$/)) === '["A","B"]',
    "KNOWN-GOOD: every twin, in order, trailing space and CRLF trimmed");

  // ── v4: the named hook file, read the way v3's backtracking pattern read it ────────────
  const nameCases = [
    ['node "$CLAUDE_PROJECT_DIR/.claude/hooks/bash-gate.js"', "bash-gate.js"],
    ["node C:\\dev\\p\\.claude\\hooks\\g.js", "g.js"],
    ["node x/.claude/hooks/a.js.bak", "a.js"],
    ["node x/.claude/hooks/a.claude/hooks/b.js", "b.js"],
    ["node x/.claude/hooks/a.js/.claude/hooks/b.js", "b.js"],
    ["echo .claude/hooks/ then node .claude/hooks/c.js", "c.js"],
    ["node .claude/hooks/.js", null],
    ["node scripts/g.js", null],
  ];
  for (const [cmd, want] of nameCases) {
    const got = namedHookFile(cmd);
    ok(got === want, `namedHookFile(${JSON.stringify(cmd)}) → ${JSON.stringify(want)} (got ${JSON.stringify(got)})`);
  }
  const nested = registrations({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node /x/hooks/y/.claude/hooks/g.js" }] }] } });
  ok(nested.length === 1 && nested[0].file === "g.js",
    `a registration's file is what follows the LAST hooks/ in its path (got ${JSON.stringify(nested[0]?.file)})`);
  const win = registrations({ hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "node C:\\dev\\p\\.claude\\hooks\\g.js" }] }] } });
  ok(win.length === 1 && win[0].file === "g.js",
    `…and a Windows path's too, backslashes and all (got ${JSON.stringify(win[0]?.file)})`);

  // ── the shipped placeholder, both directions ────────────────────────────────────────────
  // The KNOWN-GOOD is load-bearing: a placeholder test that fires on real prose would make every
  // configured project red, and a check that cries wolf gets deleted rather than fixed.
  {
    const plCases = [
      ["KNOWN-GOOD: a real reason passes", "settings cannot express a token at command position, only a substring of the whole line", false],
      ["KNOWN-GOOD: a real reason that happens to contain the word replace", "we replace the deploy step's own guard, so a settings rule would double-prompt", false],
      ["canon's shipped twins placeholder fires — the greenfield case, 2026-09-09", "Replace with this project's twins, or state why the gates below have none.", true],
      ["a bare TODO fires", "TODO", true],
      ["TBD fires", "tbd — come back to this", true],
      ["an angle-bracket slot fires", "<why settings cannot express it>", true],
      ["an e.g. left in place fires", "e.g. the deploy command", true],
      ["an empty reason fires", "   ", true],
      ["a reason echoing the instruction fires", "state why the gates below have none", true],
    ];
    for (const [label, reason, wantFire] of plCases) {
      const got = isPlaceholderReason(reason);
      const ok = got === wantFire;
      if (!ok) failed++;
      console.log(`  ${ok ? "✓" : "✗"} ${label}`);
    }
  }

  console.log(failed ? `\n❌ ${failed} probe(s) wrong` : "\n✅ probes green — registration, declaration and reconciliation all fire");
  process.exit(failed ? 1 : 0);
}

if (isEntry && !process.argv.includes("--selftest")) {
  const findings = audit(".");
  if (findings.length) {
    console.log(`\n❌ ${findings.length} hook-registration finding(s):\n`);
    for (const f of findings) console.log(`  ${f}`);
    process.exit(1);
  }
  console.log("🪝 hooks — every hook is registered in settings, declares its twin, and its twins are present");
}
