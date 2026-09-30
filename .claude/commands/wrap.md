---
description: Session close — gate, walk, commit, registers, handoff report, and the handoff artefacts disposed of
---
<!-- @kit wrap v1 — tracked OUTSIDE its KIT:CONFIG regions. Edit it in dev-standards and re-adopt;
     a change outside a region is a fork, and check-kit-drift says so. -->

Close out the session. A session that ends without this is one someone else pays for later.

1. **Run the gate.** It must exit 0. Fix the failures or report them explicitly; never wrap over a
   red gate.

   <!-- /* KIT:CONFIG gate — yours: the gate command, and any domain suites that must also pass */ -->
   `npm run check`, and `npm run test:dates` too if dates were touched.
   <!-- /* KIT:CONFIG /gate */ -->

2. **If code shipped, run `/walk` first** and fold the surviving findings into the report.

3. **Commit everything that is done**, split by concern, so each commit reads on its own. A
   done-report describing uncommitted files is a contradiction.

4. **Push, or do not, as this project's rule says:**

   <!-- /* KIT:CONFIG push — yours: this project's push rule */ -->
   **DO NOT PUSH.** Stéan walks and visually checks the work before it goes out. Leave the commits
   local, report them, and wait to be told. The bash-gate prompt is not an invitation.
   <!-- /* KIT:CONFIG /push */ -->

5. **Update the registers** this session touched. CHECK a register before minting a number in it —
   a number minted without looking is how two things get the same one.

   <!-- /* KIT:CONFIG registers — yours: which registers, and where a new entry goes */ -->
   - `brief/` — a new fact in `EVIDENCE.md` with its source, a decision in `DECISIONS.md`, anything
     waiting on a person in `GATES.md`; `CURRENT.md` rewritten; `npm run brief:status`.
   - `docs/CANON-FINDINGS.md` — the outbox: a defect in canon in §1, an adoption or pin in §3.
   - `docs/MECHANISABLE.md` — a CLAUDE.md §5 rule gaining or losing a mechanism.
   - `scripts/architecture-audit.mjs` — `KNOWN_DEFECTS` only shrinks; an allowlist entry carries its reason.
   <!-- /* KIT:CONFIG /registers */ -->

6. **Produce the handoff report:**
   - What shipped, as commits (SHA + subject) — origin SHAs if pushed, and say which are not.
   - Deviations from what was asked — each flagged with its reasoning, never silent.
   - Walk-list: the judgment calls worth eyeballing, ranked.
   - Live-data claims, each backed by the query that produced it.
   - What is deliberately NOT done, and what unblocks it.
   - For every defect named, latent or reachable — "wrong but unreachable" and "wrong and live now"
     are different sentences.

7. **Dispose of the handoff artefacts** (4-AGENT-PIPELINES §9) — per TASK, not per session:
   - **File every Promote nomination first.** A nomination is not a filing; only you may file it,
     and only into a register that already exists. File it now, while the context that makes it
     meaningful still exists.
   - **Record each disposition**, appended to its `Promote` line or on a line of an `NN-main.md`
     beside it that names the artefact's file: `→ filed: <where>` or `→ declined: <reason>`. Then
     run `node scripts/check-handoff-contract.mjs --clearable <slug>` and delete only on exit 0 —
     1 means a nomination is undisposed, 2 means there is no such slug.
   - **Then `rm -rf .handoff/<task-slug>/`** for each task whose work is committed and whose
     nominations are disposed. The observation dies; the decision survives.
   - **A task that ABORTED keeps its directory.** An abort means a decision is pending, and those
     artefacts are its evidence. Clear it when the decision is made.
   - Say in the report which slugs were cleared, which were kept, and why.

$ARGUMENTS
