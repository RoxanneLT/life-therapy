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
Applied:  life-therapy → probes on all 37 audit checks (2026-08-18)
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
          Corollary: every incident-class hook rule carries a settings-level twin
          at the same or stronger verdict, and the comparison is a set difference,
          not a judgement call. This is the probe that a hook-based control needs
          and that L-002's planted-violation discipline cannot supply, because the
          failure is the hook not running at all.
Applied:  life-therapy → open item, this session
          pleks        → open item
```
