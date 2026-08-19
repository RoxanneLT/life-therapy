# LESSONS — pointer, and this project's open items

**The ledger lives in `dev-standards/LESSONS.md`** — its own git repo, with
`check-lessons.mjs` enforcing that every `Applied:` line is a date or a reasoned `n/a:`.
Read it at session start and look for open items naming **life-therapy**.

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
> `dev-standards/LESSONS.md L-21`. Never `docs/LESSONS.md L-nn` — there are no numbered entries
> in this file, and the audit fails a citation that names it with an ID.

---

## Open items from the shared ledger naming this project

Surveyed 2026-08-19 against L-01…L-13; L-14…L-24 were contributed by this project or written
alongside it. **Nothing is currently outstanding.** The two that were — L-04 (a marker the parser
cannot read) and L-10 (an enumeration that can enumerate zero) — were closed the same day they
were found, and what each turned up on the way is worth keeping:

- **L-04** — every marker namespace now resolves against its own source of truth: `audit:` a check
  name, `hook:` a file, `settings:` the permission entry it names. `eslint:` cannot be resolved
  statically at all, because the rules that matter arrive from presets and never appear in the
  config, so that tag carries a **probe record** instead — a manual verification written down
  rather than an inferred one.
- **L-10** — `audit: the source enumeration has not decayed`, a floor of 400 against a real count
  of 542. Deliberately not `> 0`, which still passes when a walk decays to one file.

When an entry in the shared ledger gains a `life-therapy` line, or should have one and does not,
this is where the work is tracked. **An unapplied lesson is an open item here — not an `n/a:`
there.** The two states in that ledger are a date or a reasoned "does not apply"; "we have not
looked yet" is neither, and writing it as one is a `pending` in disguise.
