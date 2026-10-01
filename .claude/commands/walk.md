---
description: Adversarial walk of the current work before it goes out — spawn the walker, verify the claims with read agents, fold the findings in
---
<!-- @kit walk v1 — tracked OUTSIDE its KIT:CONFIG regions. Edit it in dev-standards and re-adopt;
     a change outside a region is a fork, and check-kit-drift says so. It restates no spine:
     scripts/check-commands.mjs fails a command that copies one. -->

Walk the work just completed. You are trying to REFUTE the done-report, not confirm it. The walker
does the walking, with a context that never saw the author's reasoning; its method lives in
`.claude/agents/walker.md`, and this command does not restate it.

1. **Pick one slug for this walk** — `walk-<topic>` — and number the spawns in the order you send
   them, one `NN` each. A re-walk takes the next free number; it never reuses one.

2. **Spawn the `walker` in the background**, with this brief and nothing inline:

   ```
   pipeline: walk · step 1 of <N> · artefact: .handoff/walk-<topic>/<NN>-walker.md
   <what was done · the range to walk (below) · the claims under test · the upstream artefacts it may read, by path>
   ```

3. **While it runs, send the claims out — all in ONE message**, so they run concurrently: one
   `db-inspector` per live-data claim, one `census` per repo-wide pattern claim.

   ```
   pipeline: walk · step <NN> of <N> · artefact: .handoff/walk-<topic>/<NN>-db-inspector.md
   pipeline: walk · step <NN> of <N> · artefact: .handoff/walk-<topic>/<NN>-census.md
   ```

   A census brief names the synonym spellings and one known positive: a zero counts only when the
   search demonstrably finds that positive.

4. **Read the artefacts, not the replies.** Each agent returns its contract block. Relay it
   verbatim, and open the artefact at the section it names. Never brief "return your findings as
   text": the artefact is where a finding lives.

5. **Walking inline instead** — no agent available, or a one-line change — means applying
   `.claude/agents/walker.md` §Method in full, every step, and the surfaces below it. A walk run
   from Main that skips steps is weaker than the agent's and reads the same.

6. **Report the surviving findings**, most severe first, each marked as the walker marked it. If
   nothing survived, say so plainly.

**The range this project walks:**

<!-- /* KIT:CONFIG range — yours: the range a walk diffs against */ -->
`origin/master..HEAD` — `git fetch origin` first, and diff every claim against the pushed state:
uncommitted work that a report calls "done" IS a finding.
<!-- /* KIT:CONFIG /range */ -->

**This project's standing walk surfaces** — the checks every walk here adds, and the precedents that
paid for them. Evidence is project property; canon ships this empty.

<!-- /* KIT:CONFIG surfaces — yours: domain surfaces and precedents, each with its cost stated */ -->
- **Fail-open.** For every guard, check or computation touched: if the input is malformed, missing,
  stale or out of range, does the code fail toward "looks valid"? Precedents: an `Invalid Date`
  compares `false` both ways, so a Prisma `where` built from one silently matches nothing and reads
  as "no rows"; V8 rolls `2025-02-29` forward to 1 March rather than rejecting it; a zone-less
  datetime string resolves in the *server's* timezone (UTC on Vercel).
- **Composition.** Do the gate and the computation it guards anchor on the same value, the same
  timezone resolution, the same end of the range? Precedent: the invoice CSV rows were fixed to
  render in SAST while the CSV *filter* still built financial-year boundaries at local midnight, so
  an invoice displaying 1 March exported inside FY2026.
- **Dates** → `lib/dates.ts`: a `@db.Date` is a day, `paidAt` is a moment, the SAST day turns at
  22:00 UTC. If dates were touched, `npm run test:dates` too.
- **Money** → no hardcoded price or currency, `formatPrice(cents, currency)`, `priceZarCents` is
  misnamed (cents in `priceCurrency`).
- **Actions** → `requireRole()` first, `revalidatePath()` after, `recordAudit()` on state changes,
  no side effects in a "save".
- **A value given authority.** If the diff makes anything accept a value as proof (a token, a
  reference, an id in a URL), list where that value ALREADY appears: URLs that analytics records,
  logs, emails, older formats. Precedent: buy-now made order references random so a page could
  serve a download on one, and that turned cart references, already recorded by GA on
  /checkout/success, into credentials (CANON-FINDINGS CF-7).<!-- /* KIT:CONFIG /surfaces */ -->

$ARGUMENTS
