# CANON-FINDINGS — what this project owes `dev-standards`

<!-- Kit row `canon-findings`, a TEMPLATE: yours after the copy, and never compared. Modelled on
     pleks's, which opened the first one on 2026-09-10 after a finding carried in a chat report went
     a session undelivered. -->

`dev-standards` is **read-only from this session** (`CLAUDE.md` §1), so anything owed to it is
written here, ready for an estate session to lift **verbatim**. Three things are owed to it, and
each has a section.

**This is an OUTBOX, not a register.** An item leaves when canon files it and drops to **Filed**
with the canon SHA that took it. An empty outbox is the healthy state.

⚠ **Never write "pending" anywhere canon will read.** `LESSONS.md`'s `Applied:` has exactly two
states — a date, or `n/a:` with a reason. A lesson you have not answered is not a value; it is an
open item in this project's queue, and it stays in the `--emit-open` list until it is answered.

---

## 1 · Findings about the method

A defect in canon — a playbook, a standard, a kit file, a check. The portability test decides
whether it belongs here or in this project's own scars: *would it still be true on a repo with a
different stack?*

```
### CF-1 · <the claim, in one line>
OBSERVED   what happened, in one sentence
COMMAND    what you ran, and its output verbatim
WHY IT IS  why it is the method's defect and not this project's
CANON'S
SMALLEST   the narrowest fix, and what it must not break
FIX
```

*None.*

---

## 2 · Lesson answers

From `node <canon>/tools/check-lessons.mjs --emit-open <project>`. Read the entry before answering.
A date is the day this project's tree came to carry the lesson, with the evidence that shows it; a
reasoned `n/a:` closes an item as surely as a date. "Not yet" is not an answer — leave the lesson
off this table and it stays open.

| Lesson | Answer — `YYYY-MM-DD` or `n/a: <reason>` | Evidence — SHA, path or command |
|---|---|---|

---

## 3 · Kit reports

Adoptions canon has to record in `kitAdopted`, and pins: a row deliberately behind canon, with the
row id, the version held, the reason, and a review date. A pin means *read and deliberately behind*,
never *exempt*, so the reason has to argue it.

| Row | Version | What | Evidence |
|---|---|---|---|
| `check-brief` | v5 | adopted 2026-09-10, from canon's history at `6a0f5ed`, `names` region carried | `bafd9e3` · `apply-kit --project life-therapy` → `= identical check-brief` · live run `brief: conformant · 1 of 9 not measured` |
| `canon-findings` | v1 | adopted 2026-09-10 — this file, a template, copied from canon's history at `6a0f5ed` | the commit that adds this file |
| `settings` | v3 | the M-KIT-22 claim is now committed here — `"PowerShell"` in `permissions.deny`. Nothing to record in `kitAdopted` (the row is asserted, not adopted); listed so canon sees the claim is held by a commit and not by a working tree | `2ea2ca6` |

No pins.

---

## Filed

A pointer, not a restatement — the canon entry is the record.

| # | Item | Filed as | Canon SHA |
|---|---|---|---|
