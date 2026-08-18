# LESSONS — portable findings

Cross-project lessons. An entry qualifies only if it is **stack-independent**: the
general form must hold for a repo that shares none of this one's tooling.

`Applied:` is a propagation ledger, not a queue. Each project gets either a **date it
was applied** or **`n/a:` with a reason**. Never `pending` — a status with no owner and
no date is an aspiration, and aspirations do not belong in a record of what happened.
A lesson that is known but not yet actioned in a project is an open item **in that
project's queue**, carried here as `open item` with what it is gated on.

> **Where this file should live:** a small git repo shared across projects, per
> SPEC_CLAUDE_MD_STANDARD §10-B. It sits in `life-therapy/docs/` for now so it has
> version history from day one. Moving it is a `git mv` and an update to the two
> CLAUDE.md files that will reference it.

---

### L-001 · A gate keyed on the command string misses indirect credentials

```
Date:     2026-08-18
Origin:   life-therapy
Cost:     5 schema changes reached production ungated
Class:    enforcement-bypass
General:  A gate matching on how a target APPEARS in a command fails the moment
          the working path supplies it by reference (--env-file, $VAR, config).
          Match on the RESOLVED target; where it cannot be resolved statically,
          gate at the point the statement is WRITTEN, which is also the last
          point a human can still read it.
Applied:  life-therapy → .claude/hooks/ddl-gate.js (2026-08-18)
          pleks        → open item, gated on SPEC_AGENT_ENVELOPE H3/H4
```

### L-002 · A check that cannot fail reads exactly like a check that passes

```
Date:     2026-08-18
Origin:   life-therapy (independently rediscovered in the same week)
Cost:     two checks sat green for months; one never fired at all
Class:    unfalsifiable-control
General:  Controls fail silently and look identical to working ones from outside.
          Two real shapes, both from scanning PREPROCESSED source: a check for a
          timezone offset scanned comment-stripped text, where string literals —
          the only place an offset ever lives — had already been removed; a check
          matched its own explanatory comment and so always passed.
          Plant a violation, confirm the control FAILS, remove it, keep the probe.
          A control is not shipped until it has been observed failing.

          Negative-fixture shapes worth keeping, each one a real first-run false
          positive or a real unfalsifiable check:
            1. scanning preprocessed source for a string literal
            2. a pattern matching its own explanatory comment
            3. a regex spanning a statement boundary into unrelated code
            4. an extension alternation truncating .json → .js, .tsx → .ts
            5. an identifier wrapped across a line and read as missing
            6. a code snippet that merely resembles a control id
            7. NEAR-MISS BY NORMALISATION — a hand-written id that slugifies
               close to a real one but not to it. Observed: a tag written
               `...-no-hardcoded-offset` against a control whose real name
               normalises to `...-no-hardcoded-02-00-offset`. Eleven characters
               of drift in a tag whose entire job is not drifting; found only
               because someone happened to run the comparison by hand.
Applied:  life-therapy → probes on all 38 audit checks (2026-08-18)
          pleks        → open item
```

### L-003 · Instruction-file comments are stripped before the model sees them

```
Date:     2026-08-18
Origin:   life-therapy (canary CANARY-HTML-7Q4X)
Cost:     none — caught by experiment before the format was committed to
Class:    load-model
General:  HTML comments in an instruction file do not reach the model. Two
          consequences, opposite in sign:
            · enforcement tags are FREE — they cost no context and are read from
              raw source by tooling. The build is their reader.
            · a warning in a comment is INVISIBLE exactly where it matters.
          So split by who needs to read it: @enforced is a comment; a rule that
          NOTHING mechanical covers must say so in visible prose, because model
          attention is then the only control and it cannot attend to what it
          cannot see.
          Note the boundary: only INSTRUCTION files are preprocessed. Comments in
          source files arrive as ordinary file content and are unaffected.
          Second-order: visible budget is then spent only on unenforceable rules
          and shrinks each time one is mechanised — the size ceiling stops being
          a constraint and becomes a price on not mechanising.
          Which changes the metric. Total line count is the wrong number to
          watch: it moves for scaffolding, scars and orientation, none of which
          the ratchet is trying to reduce. Report N UNENFORCEABLE RULES and the
          delta since the last pass. That number should only ever go down, and
          each decrement is a rule that acquired a net.
          Baseline, life-therapy 2026-08-18: 8 unenforceable of 19.
Applied:  life-therapy → A1 format split (2026-08-18)
          pleks        → open item
```

### L-004 · An unscoped rule file loads in full, every session

```
Date:     2026-08-18
Origin:   life-therapy
Cost:     none here; a 60k-character split in a sibling project may have bought
          nothing, which is what prompted the test
Class:    load-model
General:  Splitting an oversized instruction file into a rules directory does NOT
          reduce per-session load unless each file declares the paths it applies
          to. Without that declaration it loads at launch at the same priority as
          the main file. Verified by cross-session A/B, one variable: the file was
          in context at launch with no frontmatter, and absent once it had some.
          Corollary: a size ceiling on the main file alone measures the wrong
          thing. Measure everything loaded at launch.
Applied:  life-therapy → paths: on .claude/rules/schema-changes.md (2026-08-18),
                         retention gated on the trigger test (E1b)
          pleks        → open item: 16 rule files, frontmatter status unchecked
```

### L-005 · Suppression without a mechanical twin is deletion of protection

```
Date:     2026-08-18
Origin:   life-therapy
Cost:     none — caught before scoping a rule file
Class:    defence-in-depth
General:  Scoping a rule out of default context removes its prose from every
          session that doesn't touch its paths. That is safe ONLY where the
          incident-class content of that prose is also held by a control that
          fires regardless of what loaded.
          Before scoping any rule file, check each incident-class statement in it
          for a mechanical twin. One that fails the check must not be scoped until
          it passes. This is what makes a context ceiling safe to enforce at all —
          without it, cutting prose is trading safety for tokens.
Applied:  life-therapy → prisma rule verified against bash-gate.js:43, which
                         denies unconditionally and carries the remediation path
                         in its own refusal message (2026-08-18)
          pleks        → open item, gated on the envelope hooks shipping first.
                         migrations.md and finance-trust.md are expected to FAIL
                         this check today, since H1–H4 exist only as spec.
```

### L-007 · A check that passes without executing its subject

```
Date:     2026-08-18
Origin:   pleks (4 instances) · life-therapy (1, while writing this entry)
Cost:     a suite reporting success on a run where setup had failed
Class:    unfalsifiable-control
General:  L-002 covers a check that cannot FAIL. This is its sibling: a check
          that never RAN and reports success anyway — setup fails, the subject
          is never invoked, the harness sees no failures and prints green.
          Absence of failure is not evidence of execution.
          The agent-facing form is worse, because the agent cannot see the
          difference. Observed live: a probe written as
              <command>; echo "completed without a prompt"
          where the echo runs unconditionally. The command asserted its own
          conclusion, and the output was indistinguishable from evidence.
          Probe: break the SUBJECT, watch the check fail. If it still passes,
          the check was never reaching it.
          Corollary for agents: never report on a signal you cannot observe.
          A permission prompt, a hook firing, an approval — these leave the
          tool result identical either way. Ask the human; do not infer.
Applied:  life-therapy → open item: twin-interception probes await human
                         observation (see L-006, B3)
          pleks        → open item
```

### L-008 · Read the decision log before calling something drift

```
Date:     2026-08-18
Origin:   pleks (twice in one day)
Cost:     two proposals to "fix" live state that was deliberate
Class:    false-positive-handling
General:  A deliberate asymmetry is indistinguishable from an oversight to
          anyone who arrives after the decision. Without a log, every reviewer
          re-investigates it, and eventually one of them "fixes" it — which is
          how a considered decision becomes a bug.
          This is the allowlist-with-reasons doctrine arriving as an INCIDENT
          in the project that specified it, which is the finding: a lesson that
          lives in a spec rather than where the work happens has not been
          applied. Read the log for intent before proposing to change state.
Applied:  life-therapy → allowlists carry a reason per entry, and
                         `allowlists: every exemption is still load-bearing`
                         fails when one stops suppressing anything (2026-08-18)
          pleks        → open item
```

### L-009 · Drift-vs-replay: two artefacts with a common ancestor

```
Date:     2026-08-18
Origin:   pleks
Cost:     a comparison that could not have found what it was looking for
Class:    unfalsifiable-control
General:  A check that compares two artefacts derived from a common ancestor
          cannot detect anything they inherited together. It finds divergence,
          which is not the same as error, and reports agreement as correctness.
          Verify against ground truth, not against the sibling.
Applied:  life-therapy → n/a: no generated-artefact pair here. The nearest
                         shape is prisma/schema.prisma vs the live database,
                         and that is already verified against the DB itself
                         via `prisma db pull`, not against a sibling copy.
          pleks        → open item
```

### L-010 · A hook "allow" short-circuits the permission system

```
Date:     2026-08-18
Origin:   life-therapy
Cost:     none — an untested belief, written into two files as fact for a day
Class:    defence-in-depth
General:  A PreToolUse hook that returns "allow" does not merely decline to gate —
          it ANSWERS, and the settings-level rules are never consulted. Both the
          hook's own header and the project instructions claimed the two layers
          were belt-and-braces. Measured: a command matching an `ask` rule, which
          the hook allowed, ran with no prompt.
          The design survives, but its description was inverted. A settings twin
          is DORMANT BY DESIGN while the hook lives, and covers exactly one
          scenario: the hook dead (L-006). That is not a weaker guarantee — it is
          the guarantee, correctly stated.
          Testing corollary: a twin cannot be probed while the hook is alive,
          because the hook answers first. Verifying one means disabling the hook
          and re-running — which is also a faithful rehearsal of the only
          situation the twin exists for. A probe run WITHOUT disabling it proves
          nothing and looks like a result (L-007).
Applied:  life-therapy → both claims corrected; twin-verification procedure
                         recorded in bash-gate.js (2026-08-18)
          pleks        → open item
```

### L-011 · Path-scoped rules fire on Read, not on Write

```
Date:     2026-08-18
Origin:   life-therapy (E1b)
Cost:     none — measured before any incident-class prose was scoped
Class:    load-model
General:  A rule file scoped by `paths:` is deferred, not suppressed: reading a
          matching file injects it. But WRITING a new file at a matching path
          does not. Measured both directions in fresh sessions, same glob.
          So a scoped rule reaches the session that reads before it writes and
          misses the one that doesn't — protection present exactly when it is
          least needed.
          RULE: never scope incident-class prose. Scope it only where a rung-1/2
          control holds the incident-class content regardless (L-005), or accept
          that the careless session will not see it.
          Plausible mechanism, not relied on: Read delivers file content and the
          rule rides along; Write delivers none.
Applied:  life-therapy → schema-changes.md stays scoped, because bash-gate denies
                         prisma migrate unconditionally (2026-08-18)
          pleks        → open item — 18 rule files, all scoped, 931 lines. Each
                         needs the L-005 pass before this is safe.
```

### L-012 · A subagent misreported its own context

```
Date:     2026-08-18
Origin:   life-therapy (E3)
Cost:     a false finding written into the instruction file, cited as support for
          a doctrine, and caught only because a second run disagreed
Class:    unfalsifiable-control
General:  Two probes of the same question returned opposite answers. One reported
          "no CLAUDE.md in my context." The other reported it present, named the
          delivery wrapper, and TRANSCRIBED the first six lines — including
          freshly-edited text it could not otherwise have known.
          The positive-with-proof wins, on the protocol's own rule: a bare
          negative cannot distinguish absent from overlooked. The first probe was
          an agent misreporting its own context — the exact failure the
          transcribe-don't-report protocol was written to catch, occurring inside
          that protocol.
          Two general forms:
            · An agent is not a reliable narrator of its own context. Ask it to
              TRANSCRIBE, and treat a negative as unresolved rather than as a no.
            · Run any self-observation probe TWICE. A single run is one witness,
              and this one would have shipped a false fact.
          Substantively: subagents DO receive project instructions. The doctrine
          that leaned on their absence still holds — a narrow-task agent skims —
          but a false mechanism was arguing for a true conclusion, which is the
          kind of support that collapses the day someone checks it.
Applied:  life-therapy → finding corrected in CLAUDE.md, and the doctrine reworded
                         from "absent" to "present but unattended" (2026-08-18)
          pleks        → open item
```

### L-006 · A hook is a single point of failure, and it degrades silently

```
Date:     2026-08-18
Origin:   life-therapy
Cost:     latent — found by inspection, never triggered
Class:    defence-in-depth
General:  L-005 leans on hooks surviving context loss. They survive context loss;
          they do not survive themselves. A hook whose script path breaks reports
          a non-blocking status nobody reads, and every rule it alone held
          degrades WITHOUT FAILING — deny becomes ask, ask becomes allow.
          Measured in one repo: of five hook rules, two had no settings-level twin
          at all (rm -rf on root, ad-hoc SQL against production) and one degraded
          from deny to ask (prisma migrate). None of that is visible from a green
          run.
          Corollary: every incident-class hook rule carries a settings-level twin,
          and the comparison is a set difference, not a judgement call. This is the
          probe a hook-based control needs and that L-002's planted-violation
          discipline cannot supply, because the failure is the hook not running.

          The pairing is ASYMMETRIC, and "equal-or-stronger verdict" is wrong
          wherever the settings language is coarser than the hook's:

            hook     → precise pattern, DENY   (the smart layer)
            settings → coarse pattern, ASK     (the dumb, unkillable layer)

          A coarse deny in the dumb layer false-positives forever and cannot be
          taught better — a naive pattern once denied an innocent commit whose
          heredoc merely mentioned the gated command. A coarse ask puts a human in
          the loop exactly when the smart layer is gone, and costs only an
          occasional prompt while it is alive. Ask is the floor; absent is the
          violation. If a twin prompts too often, NARROW it — never delete it.
Applied:  life-therapy → @twin markers + audit check `hooks: every incident-class
                         gate has a settings twin` (2026-08-18). Closed both live
                         gaps: rm -rf on root/home, and ad-hoc production SQL
                         (twinned coarsely at `Bash(curl*)`, since settings cannot
                         match a URL mid-command and curl's two documented uses
                         here both deserve a prompt anyway).
          pleks        → open item, gated on the envelope hooks shipping first
```
