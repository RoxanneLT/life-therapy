# Runbooks

> **run** — procedures a person executes.

Both entries moved here from `docs/` on 2026-09-09 when this brief was seeded. Neither was
referenced by anything in the tree — a zero-hit grep across every file outside `node_modules` is
what made the move safe rather than assumed. They were numbered on arrival, which is also what
gives B-7 something to read: before them, no document's number could be parsed and the collision
check reported *skipped* rather than a false zero.

| File | What it settles |
|---|---|
| `01-bunny-cdn-setup.md` | Standing up Bunny.net from a cold account: a Storage Zone plus Pull Zone for downloadable PDFs and worksheets, a Stream library for course video, the environment variables both need, and the admin-panel walkthrough. Uploads go through the admin panel — the Bunny dashboard is for setup only. |
| `02-supabase-auth-email-templates.md` | The five Supabase Auth email templates — reset password, confirm signup, magic link, change email address, invite user — with subject and body for each. They are pasted into the Supabase dashboard, not edited in this repo, which is the whole reason they need a runbook. |
