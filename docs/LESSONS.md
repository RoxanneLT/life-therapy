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
session is mid-edit and its output comes from code no commit contains — `docs/CANON-FINDINGS.md`
CF-1. Run the committed one instead:
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

### Queued: applies here, not carried

- **L-35 · L-49 — the audit's `code()` deletes real code, and says nothing when it does.**
  `code()` (`scripts/architecture-audit.mjs`) is a regex pass standing in for a tokenizer. It blanks
  strings with a double-quote pass that runs before the single-quote pass, so a `'"'` character
  literal opens a "string" that swallows code up to the next `"`. A regex literal containing a quote
  does the same. The TypeScript scanner, which is in the build already, answers the question
  exactly (L-35). Measured 2026-09-10 with that scanner as the oracle: every identifier outside a
  template literal, checked for survival on its own line, across 546 files under `app/`, `lib/` and
  `components/`. **In 10 files `code()` deleted real code, 904 identifiers in total.** The worst:
  `client-importer.tsx` (475, from line 33), `lib/email-templates.ts` (136), `admin-header.tsx`
  (105), `portal-header.tsx` (99), `app/api/track/open/route.ts` (35). Then `lib/email-tracking.ts`
  (20), `lib/csv.ts` (16), `admin-sidebar.tsx` (9), `lib/utils.ts` (8), `lib/safe-redirect.ts` (1).
  Roughly two dozen checks read through `code()`, so in those regions every one of them reports
  "no findings" when it had no visibility (L-49). The work is to replace `code()` with
  `ts.createScanner` and blank by token kind. Failing that, compute the desync (an unbalanced
  quote at end of line is the signature) and make each check say which files it could not read.
  Probe with the ten files above: each must come back identical in identifiers to the parser's view.

When an entry in the shared ledger gains a `life-therapy` line, or should have one and does not,
this is where the work is tracked. **An unapplied lesson is an open item here — not an `n/a:`
there.** The two states in that ledger are a date or a reasoned "does not apply"; "we have not
looked yet" is neither, and writing it as one is a `pending` in disguise.
