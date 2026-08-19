# MECHANISABLE — the build queue for rules nothing catches

**6 entries** as of 2026-08-19. Every rule in `CLAUDE.md` §5 has one, because §5 is defined as
"held by attention alone" and this file is where each of those either gets a plan or an argument
for why it cannot have one.

**This is a build queue, not doctrine — it only shrinks.** An entry leaves when its mechanism
ships and the rule swaps its `UNENFORCEABLE` marker for `@enforced`, moving it from §5 to §4 and
dropping the binding count that `npm run audit` prints. Do not add speculative entries; do not
widen an entry to cover something the rule never claimed.

**Why the sketches live here and not in the rule.** §5 is *visible* budget by design — an
`UNENFORCEABLE` marker has to reach the model, because attention is the only control and attention
cannot attend to what it cannot see (E2). But the *measurement* behind each one does not have to.
The rule keeps its one-clause reason and a pointer; the evidence lives here, where it costs
nothing per session and can be as long as it needs to be.

**Ranking: blast radius, then cost.** Bands in order — `money` → `data-boundary` → `schema` →
`auth` → `other` — and within a band, cheapest mechanism first. Adopted from the sibling project's
register; the ordering is the useful part, because "which of these six should I build" is
otherwise a matter of whoever last got annoyed.

**A measured refusal is a result.** Two entries below close as *will not build*, and they carry
the numbers that say so rather than an opinion. That is a finish, not a gap — an unmeasured
"cannot be mechanised" is unfalsifiable, so it gets re-litigated by everyone and acted on by
nobody (`dev-standards/LESSONS.md` L-18).

---

## SCHEMA

### M-01 — Schema changes happen only when asked

- **Rule:** "Never modify the Prisma schema without being explicitly told to." (`CLAUDE.md` §5)
- **Rung:** none possible for the asking · **Blast:** schema
- **Status:** **partly built, and the built half is the half that matters.**

The dangerous path *is* mechanised: `prisma migrate` and `prisma db push` are denied outright by
`hook:bash-gate` (with a `settings:ask` twin) and by
`audit:schema-no-prisma-migrate-invocations-in-scripts`, and a file that writes DDL through the
Management API is gated at write time by `ddl-gate.js`.

What remains unenforceable is the *permission*: nothing can distinguish a schema change the user
asked for from one the model invented. That is not a gap in the tooling, it is a question about a
conversation, and no artefact in the repository carries the answer.

**Would-be sketch, and why it is rejected:** a check could require every DDL script to carry an
`@approved <date> <who>` header. It would assert only that someone typed the header — which the
same model writing the DDL would type. A control the subject can satisfy by asserting compliance
is not a control.

**Leaves this file when:** never. Marked closed-by-argument rather than open.

---

## DATA-BOUNDARY

### M-02 — Client data is never invented

- **Rule:** "Never auto-fill or guess client data. If a field needs a value you don't have, leave
  it empty or show a placeholder." (`CLAUDE.md` §5)
- **Rung:** none · **Blast:** data-boundary
- **Status:** open, no mechanism identified.

**Why it resists.** A fabricated value and a real one are the same bytes at the point they are
written. There is no shape to scan for: `phone: "082 555 1234"` is correct if the client said so
and a fabrication if not, and the difference exists only outside the codebase.

**The nearest thing that would work, and its limit.** A check could forbid *literal* client-shaped
values in seed and script files — a phone number, an email, an ID number appearing as a constant
outside `prisma/seed.ts` and the test fixtures. That catches the careless case (a script written
with a real client's details baked in) and none of the actual risk, which is a value invented at
runtime and written through the ordinary path.

Worth building if it ever costs something; not worth building speculatively. Recorded so the next
person does not re-derive the same dead end.

---

## OTHER

### M-03 — Read the source before writing code

- **Rule:** "Read the actual source files before writing code." (`CLAUDE.md` §5)
- **Rung:** none · **Blast:** other (but the highest *frequency* of the six)
- **Status:** open, and structurally unmechanisable from inside the repository.

Nothing in the tree records what was read. The harness knows; the codebase does not, and a check
runs against the codebase.

**It has a second job worth stating.** Reading is also what summons a path-scoped rule file (E1b),
so a session that writes without reading gets neither the file nor the rules that describe it.
That makes this the rule most of the others depend on — and the least catchable — which is
precisely why the incident class lives at hooks and checks instead.

**Leaves this file when:** the harness exposes a read log a check could assert against. Not
expected; recorded as the condition rather than a hope.

---

### M-04 — Extend, don't duplicate

- **Rule:** "Never create parallel systems when you can extend existing ones." (`CLAUDE.md` §5)
- **Rung:** check (partial) · **Blast:** other
- **Status:** **open, and the most promising of the six.**

**Sketch.** "Is this a duplicate system" is a judgement about intent and cannot be decided. But
*duplicate implementation* often can, and this codebase has paid for it repeatedly: five copies of
`replacePlaceholders`, two byte-identical CSV escapers, two partner lookups, four couples-invite
senders. Each was found by hand, after it had cost something.

A check could assert that named single-source helpers have exactly one definition — a registry of
`SSOT_FUNCTIONS` (`escapeHtml`, `csvCell`, `formatPrice`, `saDateStr`, `findPartnerOf`,
`sendCouplesPartnerInvite`, `removeBookingFromCalendar`) each of which must be defined once and
imported everywhere else. That is exact, needs no classification, and would have caught the CSV
escaper and the partner lookup before either shipped.

It does not catch a genuinely new parallel *flow* (a second invoicing pipeline), which is the
rule's original meaning. Half the rule, mechanically — and the half with the evidence behind it.

**Leaves this file when:** that check ships and the rule can be split into an enforced clause
("a named SSOT helper is defined once") and a residual `UNENFORCEABLE` clause about intent.

---

### M-05 — Report the outcome of a client-side action · **WILL NOT BUILD**

- **Rule:** "Use `toast` from `sonner` for success and error feedback." (`CLAUDE.md` §5)
- **Rung:** none that is worth its noise · **Blast:** other
- **Status:** **closed by measurement, 2026-08-19.**

**The numbers.** 47 of 197 client components import a server action without importing `toast`, and
**most are correct to** — a form that redirects, a component with inline errors, one that reports
through `alert()`. Narrowed to the shape that caused a real incident (a confirm dialog whose action
reports nothing) it fell to **4**, and some of those were fine too.

**Why it closes rather than waits.** "Did this report the outcome" has no code shape. Any check
either misses real cases or flags components that are correct, and a first run earning a large
allowlist means nothing thereafter.

**What was done instead.** The census found and fixed a real silent-failure bug on the way — the
drip pause/resume/reset controls reported neither success nor failure — and three incident-shaped
instances were closed individually with checks that *do* have a shape:
`confirm-dialogs`, `calendar: a cancel path removes the calendar event`, and the couples invite
now reading its send result.

---

### M-06 — Confirmation dialogs on destructive actions · **WILL NOT BUILD**

- **Rule:** "Use confirmation dialogs for destructive actions." (`CLAUDE.md` §5)
- **Rung:** none · **Blast:** other
- **Status:** **closed by measurement, 2026-08-19.**

**The number moves with the detector, which is the finding.** The count is **12 or 18** depending
purely on whether a `<Dialog>` counts as a confirmation alongside `<AlertDialog>` — and a two-step
button or an inline "are you sure" would count as well. A number that unstable is measuring the
detector, not the codebase.

**What was done instead.** The *mechanical* half of this rule — a confirm action nested inside the
dialog that dismisses it — is enforced by
`audit:confirm-dialogs-a-confirm-action-is-not-nested-inside-the-dialog-it-closes`, which was
built after every delete in the admin UI silently did nothing for the life of the feature. The
judgement half ("is this destructive") stays with the reader.

---

## Provenance of the count

The **6 of 21** figure comes from `claude-md: every rule in a rules section carries its net`, which
counts one bullet as one rule inside `### Enforced` and `## 5`. Two notes on trusting it:

- It was **9 of 21** before three rules were mechanised on 2026-08-19 (hard deletes, the
  audit-worthy list, save-action side effects). The denominator moved from 18 to 21 in the same
  pass, not because anything got worse but because rules already enforced in prose became tagged
  bullets — so the ratio is only comparable within a version of the tagging.
- An earlier figure quoted "18 tags" where there were 22 across 18 lines. That was a line count
  read as an occurrence count, and it is the reason this file names its metric's source.
