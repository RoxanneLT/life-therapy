# Gates

> Everything that cannot move without a decision from a person. **Nothing else lives here** — not
> the plan, not progress, not what was built.
>
> The **open since** column is the point: a gate nobody is chasing has quietly become a decision to
> do nothing.
>
> The row below is the shape, not a gate — `G-nn` is deliberately not a number, so the checker does
> not read it as one. Real rows start at `G-01`.

| id | Blocked | The question | Owner | Open since | Closes when |
|---|---|---|---|---|---|
| G-01 | `SETUP-NEW-PC.ps1` on the desktop, and the machine table in `CLAUDE.md` §1 | Which drive does the repo live on there? The working volume is a Windows Storage Space (RAID-10); one of C/D/E/F is OneDrive and is disqualified. | Stéan | 2026-08-17 | The chosen path is written into the §1 table, so the next session stops asking |
| G-03 | Confirming that a push actually deployed | The Vercel MCP account reachable from this session lists `yoros`, `pleks` and `sterreveld` — no life-therapy — and there is no `.vercel/project.json`. The GitHub remote is `RoxanneLT/life-therapy`, a different org. Should this session get read access to that Vercel project, or does deploy verification stay a human step? | Stéan | 2026-09-09 | Either the project is reachable from `list_deployments`, or a row here says deploy checking is done at the dashboard and this stops being reported as a gap |

## Closed

| id | Closed | Answer |
|---|---|---|
| G-02 | 2026-09-09 | **They stay in `docs/` as closed history.** A handover's value is that it was accurate on its date; inside `brief/` every claim answers to `EVIDENCE.md`, and three of the four assert counts about a tree that has moved (`139 tests` → 231, `25 audit checks` → 62, and one describing a branch state that no longer exists). Filing them where a checker holds them would force those numbers forward and destroy what the documents are for. Two things done instead of a migration: `CALENDAR_PIPELINE_HANDOVER.md` was renamed to carry its date — derived from the two SHAs it names and its own first commit, all `git log`-dated 2026-07-21 — and all four are indexed at `build/INDEX.md` under *Before this brief existed*. `SESSION_HANDOVER_2026-08-17.md` turned out to be named by path in `CLAUDE.md` §1, so it could not have moved silently either way; that reader is now in `README.md`'s table, which had listed three files and should have listed four |
