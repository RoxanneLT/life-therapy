# LESSONS — pointer, and this project's open items

**The ledger lives in `dev-standards/ledgers/LESSONS.md`** — its own git repo, with
`check-lessons.mjs` enforcing that every `Applied:` line is a date or a reasoned `n/a:`.
**Query it; never read it** — it is 240 KB. At session start:

    node <dev-standards>/tools/check-lessons.mjs --emit-open life-therapy

It prints every lesson with no `Applied:` line naming this project, its triggers, and the line it
starts on. Read each entry from that line, about 40 lines, never the whole file. An answer — a date
with evidence, or `n/a:` with a reason that argues it — goes to `docs/CANON-FINDINGS.md` §2, and
canon writes the `Applied:` line. The **session** runs this, never the gate: a gate must not depend
on the path of a sibling checkout.

⚠ **First, `git -C <dev-standards> status --short tools`.** If the tool shows as modified, canon's
session is mid-edit and its output comes from code no commit contains. Since canon `054eab2`
(this project's CF-1, now filed) the tool says so itself. Run the committed one instead:
`git -C <dev-standards> archive HEAD tools ledgers | tar -x -C <scratch>`, and run it from there.

This file used to hold twelve entries of its own. Every one has been promoted to the shared
ledger, because every one passed its admission test — a failure with a stated cost that would
recur under a different stack. What remains here is the pointer and the items only this project
can answer.

> **Why the entries left rather than being kept in both places.** Two ledgers drift, and they
> drift silently, because neither reads the other. The duplication was flagged as debt on
> 2026-08-19 and cleared the same day — and it had already cost something: four citations written
> that day read `docs/LESSONS.md L-21` and `L-22`, IDs that exist only in the shared ledger and
> never existed here. Each pointed at nothing while reading as diligence, which is the exact class
> the shared L-07 describes.
>
> **How to cite from now on.** A lesson lives in one place, so name that place:
> `dev-standards/ledgers/LESSONS.md L-21`. Never `docs/LESSONS.md L-nn` — there are no numbered entries
> in this file, and the audit fails a citation that names it with an ID.

---

## Open items from the shared ledger naming this project

**2026-09-10: 36 of 99 open** (`--emit-open`, run from canon's HEAD `6a0f5ed`). Answered in
`docs/CANON-FINDINGS.md` §2 as they are measured; one that applies and is **not** carried here is
real work, and is queued in this file or in `docs/MECHANISABLE.md` — never answered there.

⚠ **Until 2026-09-10 this section said "Nothing is currently outstanding."** That was true of the
survey it described — L-01…L-13 on 2026-08-19, with L-14…L-24 contributed by this project or
written alongside it — and it went on reading as a current state while the ledger grew to L-99 and
nothing re-ran the survey. A survey's result written as a state is a status line with no clock. The
count above carries its date and its command so the next reader can tell how old it is.

The two open on 2026-08-19 — L-04 (a marker the parser cannot read) and L-10 (an enumeration that
can enumerate zero) — were closed the same day they were found, and what each turned up on the way
is worth keeping:

- **L-04** — every marker namespace now resolves against its own source of truth: `audit:` a check
  name, `hook:` a file, `settings:` the permission entry it names. `eslint:` cannot be resolved
  statically at all, because the rules that matter arrive from presets and never appear in the
  config, so that tag carries a **probe record** instead — a manual verification written down
  rather than an inferred one.
- **L-10** — `audit: the source enumeration has not decayed`, a floor of 400 against a real count
  of 542. Deliberately not `> 0`, which still passes when a walk decays to one file.

Three items queued on 2026-09-10 have since been carried. The first one's queue entry was wrong in
two ways:

- **L-35 · L-49** (`a599577`, answered in `docs/CANON-FINDINGS.md` §2). The audit's `code()` and
  `codeKeepingLiterals()` now ask the TypeScript parser, and `audit: every source file parses`
  names what the parser could only recover from. The entry said 904 identifiers in 10 files; the
  real figure is 700 in 8. `admin-header.tsx` and `portal-header.tsx` each hold one lone `\r`, which
  TypeScript counts as a line break and `split("\n")` does not, so the oracle's line numbers were
  off and its 204 "losses" there were the harness's. And the fix it proposed, `ts.createScanner`,
  could not have worked alone: a scanner cannot tell a regex from a division, or JSX text from code,
  unless the parser drives it. The fix reads the parse tree instead.
- **L-68** (2026-09-11, answered in §2). The host layer's *"Do not use the Agent tool, workflows or
  deep-research unless requested"* is a condition, so a request meets it. Stéan made that request
  standing, in their own words: `CLAUDE.md` §7, *"STANDING AUTHORISATION — Stéan, 2026-09-11"*. The
  session waited for those words and did not draft them. They named agents only, so Stéan asked
  for wording for the rest. The session drafted it on that request, and Stéan gave it the same day
  with their own edits: workflows and deep-research, under 15 agents, each announced in one line.
  Both halves are quoted in §7.
- **L-41** (2026-09-11, answered in §2). It waited on canon: `check-handoff-contract` is canon's
  bytes with no config region. Canon filed this project's CF-4 at `61bd006`, and v5 of that check,
  adopted by the kit move of 2026-09-11, marks a cited file whose mtime falls between the anchor's
  `utc=` and the artefact's own mtime as **QUARANTINED**. It does not fail, because the conclusion
  may stand on another source. Its first live run here: 3 artefacts, 55 citations resolved, 0
  edited during their run, and 4 cited paths it names as not measured because they do not resolve.

### Queued: applies here, not carried

Nothing.

When an entry in the shared ledger gains a `life-therapy` line, or should have one and does not,
this is where the work is tracked. **An unapplied lesson is an open item here — not an `n/a:`
there.** The two states in that ledger are a date or a reasoned "does not apply"; "we have not
looked yet" is neither, and writing it as one is a `pending` in disguise.
