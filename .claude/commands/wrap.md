---
description: Session close — checks, commit, handoff report. Does NOT push.
---

Close out the session properly. A session that ends without this is a session someone else pays for
later.

1. **`npm run check`** — must exit 0 (tsc + eslint). If dates were touched, `npm run test:dates` too.
   Fix or explicitly report failures; never wrap over a red check.

2. **Commit everything that is done.** Conventional commit message, and split by concern rather than
   dumping one blob — a reviewer should be able to read each commit on its own. A done-report
   describing uncommitted files is a contradiction.

3. **DO NOT PUSH.** The standing rule on this project: Stéan walks and visually checks the work
   before it goes out. Leave the commits local, report them, and wait to be told. (The bash-gate hook
   will prompt you anyway — do not treat that prompt as an invitation.)

4. **Produce the handoff report:**
   - What shipped, as commits (SHA + subject).
   - Deviations from what was asked — each flagged with reasoning, never silent.
   - Walk-list: judgment calls worth eyeballing, ranked.
   - Live-data claims, each backed by the query that produced it.
   - What is deliberately NOT done, and what unblocks it.
   - Anything latent vs reachable — say which, and why. "Wrong but unreachable because the cron runs
     at 06:00 UTC" is a different sentence from "wrong and rendering for admins right now".

5. If code shipped, run `/walk` first and fold surviving findings into the report.

$ARGUMENTS
