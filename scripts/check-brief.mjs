#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// check-brief — conformance for `brief/`, per standards/BRIEF-STANDARD.md v1.1
//
// @kit check-brief v4 — tracked. Edit it in dev-standards and re-adopt; a local change
// here is a fork, and `check-kit-drift.mjs` will say so.
//
// Nine checks (B-1…B-9), one generator (--status), one probe (--selftest).
//
// WHY --selftest EXISTS AND RUNS IN THE GATE. CLAUDE-MD-STANDARD §4: a
// never-matching pattern reports zero violations, so tool failure and a clean
// tree are the same output. Every check below is therefore probed in BOTH
// directions against fixture trees — a planted violation must fail, and a
// known-good tree must pass. `check-gated-routes.mjs` established the shape.
//
// Usage:
//   node check-brief.mjs <projectDir>              run B-1…B-8
//   node check-brief.mjs <projectDir> --status     also rewrite brief/STATUS.md
//   node check-brief.mjs --selftest                probe both directions
//
// ABSENT SUBJECT → SKIPPED, NEVER PASSED. A check whose subject does not exist
// reports `skipped` and names what is missing; only B-1 fails on absence, because
// absence is B-1's subject. Found 2026-09-08 by Stéan: B-3 read "0 open gates, all
// complete" while GATES.md was a directory down, and B-4 still reads "0 rows" with
// no DECISIONS.md at all. Against a brief/ holding one file, FOUR checks were green.
// That is the check-spec-verification scar — a check satisfiable by deleting its
// subject — on this repo's own tooling. B-5 already had it right; the lesson was
// applied to one check and not the other seven.
//
// PRESENT BUT EMPTY IS STILL JUDGED. A GATES.md with a header and no rows is a
// project with no open gates, which is a legitimate pass. Only absence skips.
//
// Exit 0 = pass. Exit 1 = a check failed. Exit 2 = the tool could not run.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync, rmSync, utimesSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

/** This file, for probes that must SPAWN the entry point rather than call into it. */
const SELF = fileURLToPath(import.meta.url);

const SPINE = ["README.md", "EVIDENCE.md", "DECISIONS.md", "GATES.md", "CURRENT.md", "STATUS.md"];
const FOLDERS = ["product", "build", "design", "runbooks", "legal", "research", "vendors"];
const ROTATE_ROWS = 40;
const ROTATE_BYTES = 25 * 1024;
// B-8. Ceilings apply ONLY to the two files a session is told to read before starting;
// everywhere else length is not the binding constraint (BRIEF-STANDARD §7).
const CEILINGS = { "CURRENT.md": 8 * 1024, "build/INDEX.md": 40 * 1024 };
// Reserved because each is one of the four status roles under a name that does not say which.
const RESERVED = ["NOW.md", "OUTSTANDING.md", "ROADMAP.md", "PROGRESS.md", "TODO.md", "WIP.md"];

// ── helpers ──────────────────────────────────────────────────────────────────

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } };

/** Markdown table rows, minus the header and the |---| separator. */
function tableRows(text) {
  return text
    .split("\n")
    .filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"))
    .map((l) => l.trim().slice(1, -1).split("|").map((c) => c.trim()))
    .filter((cells) => !cells.every((c) => /^:?-{2,}:?$/.test(c) || c === ""))
    .filter((cells) => !/^(id|date|file|#)$/i.test(cells[0] ?? ""));
}

/**
 * Every documented .md under the seven role folders, relative to brief/, AT ANY DEPTH.
 *
 * RECURSIVE SINCE v4 (2026-09-09), and the previous one level was a hole, not a scope.
 * Measured on the kit's own brief: a document at `build/artefacts/00-report.md` indexed
 * NOWHERE produced `✓ pass B-2 · 1 documents, all indexed` and `✓ pass B-7`. B-9 closed the
 * same shape at `brief/` root the day before — an entry nothing walks is not merely unindexed,
 * it is unreachable by the check that would say so — and a subdirectory was the identical hole
 * one level down. **Where a file sits decides whether anything is watching it.**
 *
 * `_`-PREFIXED DIRECTORIES ARE SKIPPED, at every depth, and this is the load-bearing half.
 * `_SUPERSEDED_*` and `_ARCHIVE/` are retained-but-not-authoritative (§3.2) — a stated
 * convention that `walk`'s skipArchives, B-9's root pass and this function's own file filter
 * already honour. It is also what makes recursion affordable: pleks's `build/_ADDENDUM/` holds
 * ~162 files that nobody intends to index, and without the directory skip this change would
 * hand its first adoption a wall of ~162 findings — the L-70 retrofit that becomes a permanent
 * red line people learn to ignore.
 *
 * BLAST RADIUS, measured before the change rather than after: yoros — the only project that
 * runs this check today — holds 0 documents below one level, as does canon's own brief-kit.
 * life-therapy has no `brief/` at all. pleks's `brief/` is a OneDrive symlink this VM cannot
 * read, so it is UNMEASURED, not zero; its adoption is where this first meets a real tree.
 */
function documentFiles(briefDir) {
  // ROLE FOLDERS IN DOCTRINE ORDER, contents alphabetical within each. v3 iterated FOLDERS and
  // the first recursive draft walked brief/ alphabetically instead — the same SET of documents in
  // a different order, which silently reorders every B-2 and B-7 message. A report whose ordering
  // changes for no stated reason is a diff a reader has to re-verify, so the outer loop stays.
  const out = [];
  for (const folder of FOLDERS) collectDocs(briefDir, folder, out);
  return out;
}

function collectDocs(briefDir, rel, out) {
  const dir = join(briefDir, rel);
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith("_")) continue;
    const r = `${rel}/${e.name}`;
    if (e.isDirectory()) { collectDocs(briefDir, r, out); continue; }
    if (!e.name.endsWith(".md") || e.name === "README.md") continue;
    out.push(r);
  }
}

/**
 * The READMEs that may index a document, nearest first: its own directory's, then each
 * directory above it, then `brief/README.md`. Each is asked for the document's path RELATIVE TO
 * THAT README, so `build/README.md` indexes `artefacts/00-report.md` and the root indexes
 * `build/artefacts/00-report.md`.
 *
 * Relative-to-the-indexer, never a bare filename: the v3 folder test matched
 * `d.split("/")[1]`, which for a nested path is the SUBDIRECTORY NAME — so a `build/README.md`
 * mentioning the word "artefacts" once would have indexed every file beneath it. For a
 * one-level document the two rules are identical, which is why this is a generalisation of v3
 * rather than a new requirement.
 */
export function indexersFor(rel) {
  const parts = rel.split("/");
  const out = [];
  for (let i = parts.length - 1; i >= 0; i--) {
    out.push({ readme: [...parts.slice(0, i), "README.md"].join("/"), cite: parts.slice(i).join("/") });
  }
  return out;
}

/** Leading band number of a document name: 20-ssot.md → "20", 20.1-x.md → "20.1". */
/* KIT:CONFIG names — yours */
/**
 * How a document's number is read out of its filename.
 *
 * A REGION BECAUSE THE ANSWER IS PER-PROJECT. Canon ships the one form the standard describes —
 * `07-thing.md`, optionally `07.2-thing.md`. A project that files amendments under another shape
 * adds its pattern here rather than editing the check.
 *
 * Reported by pleks 2026-09-09, and it is L-01 with a live cost: pleks files amendments as
 * `ADDENDUM_<slot>_…`, which matches nothing below, so every one of them was dropped before the
 * collision test ran and B-7 announced ZERO collisions while nine were live — 00A 00I 14H 14R 25A
 * 45A 57H 62A 70H, two documents each. Every pattern must yield the number in capture group 1.
 */
/* LT's reading, 2026-09-09. Canon's default is taken UNEDITED, and that is a decision rather
 * than an omission: this brief was seeded today and every document in it was numbered on
 * arrival in the `NN-name.md` shape the standard describes. There is no amendment convention
 * here yet, so there is nothing for a second pattern to match — and pleks's finding is that a
 * pattern matching nothing does not fail, it makes B-7 announce zero collisions while nine are
 * live. If an amendment shape is ever adopted here, its pattern is added HERE, in the same
 * commit as the first file that uses it, or the collision check silently stops seeing them.
 *
 * Known and accepted: `brief/build/INDEX.md` carries no number, so B-7 names it every run as a
 * file it could not read. It is canon's own template spine file for `build/`, it is not a
 * document, and teaching this region to parse it would be teaching the checker to read a
 * number that does not exist. The named-and-skipped line is the correct output. */
const BAND_FORMS = [/^(\d{2}(?:\.\d+)?)-/];
/* KIT:CONFIG /names */

function band(name) {
  for (const re of BAND_FORMS) {
    const m = re.exec(name);
    if (m?.[1]) return m[1];
  }
  return null;
}

/** `skipArchives` drops `_`-prefixed files and folders: `_SUPERSEDED_*` and
    `_ARCHIVE/` are retained-but-not-authoritative (BRIEF-STANDARD §3.2), so a
    marker inside one is history, not an open question. Reporting it is the same
    class of error as passing a check whose subject is absent. */
function walk(dir, out = [], { skipArchives = false } = {}) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skipArchives && entry.name.startsWith("_")) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out, { skipArchives });
    else out.push(p);
  }
  return out;
}

function lastCommit(file, cwd) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], {
      cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out || null;
  } catch { return null; }
}

// ── the checks ───────────────────────────────────────────────────────────────

/** @returns {{id:string, ok:boolean, skipped?:boolean, note:string}[]} */
export function checkBrief(projectDir, { strictMarkers = false } = {}) {
  const briefDir = join(projectDir, "brief");
  const results = [];
  const add = (id, ok, note, skipped = false) => results.push({ id, ok, note, skipped });

  if (!existsSync(briefDir)) {
    add("B-1", false, "no brief/ folder");
    return results;
  }

  // B-1 · the spine exists and is non-empty
  const missing = SPINE.filter((f) => {
    const t = read(join(briefDir, f));
    return t === null || t.trim().length === 0;
  });
  add("B-1", missing.length === 0,
    missing.length ? `missing or empty: ${missing.join(", ")}` : `${SPINE.length} spine files present`);

  // B-2 · every topic is indexed, and every reference resolves
  const readme = read(join(briefDir, "README.md")) ?? "";
  const docs = documentFiles(briefDir);
  // A document is indexed by ANY README at or above it, citing it relative to that README.
  const indexCache = new Map();
  const indexText = (p) => {
    if (!indexCache.has(p)) indexCache.set(p, read(join(briefDir, p)) ?? "");
    return indexCache.get(p);
  };
  const unindexed = docs.filter((d) => !indexersFor(d).some(({ readme: r, cite }) => indexText(r).includes(cite)));
  // A README is required of each ROLE FOLDER and not of every subdirectory: a nested document
  // can be cited from the folder README or the root, so demanding one per level would be a new
  // obligation rather than the closing of a hole.
  const noIndex = FOLDERS.filter((f) => existsSync(join(briefDir, f)) && !existsSync(join(briefDir, f, "README.md")));
  const pattern = new RegExp(`(?:${FOLDERS.join("|")})/(?:[A-Za-z0-9._-]+/)*[A-Za-z0-9._-]+\\.md`, "g");
  const referenced = [...readme.matchAll(pattern)].map((m) => m[0]);
  const dangling = [...new Set(referenced)].filter((r) => !existsSync(join(briefDir, r)));
  const anyFolder = FOLDERS.some((f) => existsSync(join(briefDir, f)));
  if (!anyFolder) add("B-2", true, "no role folder exists yet — nothing to index", true); else
  add("B-2", unindexed.length === 0 && dangling.length === 0 && noIndex.length === 0,
    [
      noIndex.length ? `folder has no README: ${noIndex.join(", ")}` : null,
      unindexed.length ? `not in any index: ${unindexed.join(", ")}` : null,
      dangling.length ? `index points at nothing: ${dangling.join(", ")}` : null,
    ].filter(Boolean).join(" · ") || `${docs.length} documents, all indexed`);

  // B-3 · every open gate row is complete
  const gatesPath = join(briefDir, "GATES.md");
  const gates = read(gatesPath) ?? "";
  const openSection = gates.split(/^##\s+Closed/m)[0];
  const gateRows = tableRows(openSection).filter((r) => /^G-\d+/.test(r[0] ?? ""));
  const bad = gateRows.filter((r) => {
    const [id, blocked, question, owner, since, closes] = r;
    return !id || !blocked || !question || !owner || !since || !closes
      || /^<|^TBD$|^the team$/i.test(owner)
      || !/^\d{4}-\d{2}-\d{2}$/.test(since);
  });
  if (!existsSync(gatesPath)) add("B-3", true, "no GATES.md — B-1 owns the absence", true); else
  add("B-3", bad.length === 0,
    bad.length ? `incomplete: ${bad.map((r) => r[0]).join(", ")}` : `${gateRows.length} open gates, all complete`);

  // B-4 · the decision log is under the rotation threshold
  const decPath = join(briefDir, "DECISIONS.md");
  const dec = read(decPath) ?? "";
  const decRows = tableRows(dec).filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r[0] ?? ""));
  const decBytes = dec.length;
  const overRows = decRows.length > ROTATE_ROWS;
  const overBytes = decBytes > ROTATE_BYTES;
  if (!existsSync(decPath)) add("B-4", true, "no DECISIONS.md — B-1 owns the absence", true); else
  add("B-4", !overRows && !overBytes,
    overRows || overBytes
      ? `rotate: ${decRows.length} rows / ${(decBytes / 1024).toFixed(1)} KB (limit ${ROTATE_ROWS} / ${ROTATE_BYTES / 1024} KB)`
      : `${decRows.length} rows, ${(decBytes / 1024).toFixed(1)} KB`);

  // B-5 · unresolved markers.
  // SKIPPED unless --strict-markers: what counts as publishable is project-local
  // (yoros uses `published: false` frontmatter; another project may have no such
  // notion). A green that means "not measured" is the failure check-tier0 had once,
  // so this reports the count either way and only GATES on it when asked.
  const markers = [];
  for (const f of walk(briefDir, [], { skipArchives: true })) {
    if (!f.endsWith(".md")) continue;
    const hits = (read(f) ?? "").match(/\[TO CONFIRM\b[^\]]*\]/g);
    if (hits) markers.push(`${relative(briefDir, f)} (${hits.length})`);
  }
  add("B-5", strictMarkers ? markers.length === 0 : true,
    markers.length ? `unresolved: ${markers.join(", ")}` : "no unresolved markers",
    !strictMarkers);

  // B-6 · STATUS.md is not older than what it describes
  const statusPath = join(briefDir, "STATUS.md");
  if (!existsSync(statusPath)) {
    add("B-6", true, "no STATUS.md — B-1 owns the absence", true);
  } else {
    const statusAt = statSync(statusPath).mtimeMs;
    const newer = walk(briefDir)
      .filter((f) => f !== statusPath && f.endsWith(".md"))
      .filter((f) => statSync(f).mtimeMs > statusAt + 1000)
      .map((f) => relative(briefDir, f));
    add("B-6", newer.length === 0,
      newer.length ? `stale — newer since generated: ${newer.join(", ")}` : "current");
  }

  // B-7 · no two documents claim the same band or amendment number
  // THE UNREADABLE ARE COUNTED, NOT DROPPED. The first version did `if (!b) continue;` and said
  // nothing, so a document whose name it could not parse was invisible to the collision test AND to
  // the report — and "no collisions" then meant "my pattern matched nothing", which is L-01's false
  // zero arriving at a reader as a clean pass. The count now travels with the verdict, and a run
  // where NOTHING parsed is reported skipped rather than green: a check that measured none of its
  // subject has not passed it.
  const byBand = {};
  const unread = [];
  for (const d of docs) {
    // KEYED ON THE CONTAINING DIRECTORY, not on the role folder. A band number orders documents
    // WITHIN the directory that holds them — `build/00-x.md` and `build/artefacts/00-y.md` are
    // not two claims on one slot, exactly as `build/00` and `design/00` never were. For a
    // one-level document the key is unchanged from v3.
    const name = d.split("/").pop();
    const dir = d.split("/").slice(0, -1).join("/");
    const b = band(name);
    if (!b) { unread.push(d); continue; }
    (byBand[`${dir}/${b}`] ??= []).push(d);
  }
  const collided = Object.entries(byBand).filter(([, v]) => v.length > 1);
  const readable = Object.values(byBand).reduce((n, v) => n + v.length, 0);
  const unreadNote = unread.length
    ? ` · ${unread.length} name(s) B-7 CANNOT READ and did not check: ${unread.slice(0, 6).join(", ")}${unread.length > 6 ? ", …" : ""} — teach it their shape in the \`names\` config region`
    : "";
  if (readable === 0)
    add("B-7", true, `no document's number could be read${unreadNote || " — none are numbered yet"}`, true);
  else
    add("B-7", collided.length === 0,
      (collided.length
        ? `same number claimed twice: ${collided.map(([k, v]) => `${k} (${v.map((x) => x.split("/").pop()).join(" + ")})`).join(", ")}`
        : `${readable} numbered documents, no collisions`) + unreadNote);

  // B-8 · session-start ceilings, and the reserved status names
  const over = Object.entries(CEILINGS)
    .filter(([rel]) => existsSync(join(briefDir, rel)))
    .map(([rel, cap]) => ({ rel, kb: statSync(join(briefDir, rel)).size / 1024, cap: cap / 1024 }))
    .filter((x) => x.kb * 1024 > x.cap * 1024);
  const reserved = walk(briefDir)
    .map((f) => relative(briefDir, f).replace(/\\/g, "/"))
    .filter((r) => RESERVED.includes(r.split("/").pop()));
  const measured = Object.keys(CEILINGS).filter((rel) => existsSync(join(briefDir, rel)));
  if (measured.length === 0 && reserved.length === 0)
    add("B-8", true, "neither session-start file exists — nothing to weigh", true);
  else
    add("B-8", over.length === 0 && reserved.length === 0,
      [
        over.length ? over.map((x) => `${x.rel} is ${x.kb.toFixed(0)} KB (cap ${x.cap} KB)`).join(", ") : null,
        reserved.length ? `reserved status name in use: ${reserved.join(", ")}` : null,
      ].filter(Boolean).join(" · ")
      || `${measured.join(" + ")} within budget, no reserved names`);

  // B-9 · every entry at brief/ ROOT is a spine file or a role folder
  //
  // The hole this closes, measured 2026-09-09 on the kit's own brief: park an intake report and a
  // scratch file at `brief/` root and all eight checks report CONFORMANT, exit 0. B-2 walks the
  // seven role folders only, so an unindexed document there is not merely unindexed — it is
  // unreachable by the check that would say so. B-8 rejects six reserved NAMES anywhere, which is
  // a different question. So the root was the one place in the spine governed by nothing, and it
  // is the place a hurried session puts things: `1-NEW-PROJECT` phase 1 had to say "not at brief/
  // root" in prose precisely because nothing enforced it.
  //
  // WHERE A FILE SITS DECIDES WHETHER ANYTHING IS WATCHING IT. That is the whole rule.
  //
  // `_`-prefixed entries pass: `_SUPERSEDED_*` and `_ARCHIVE/` are retained-but-not-authoritative
  // (§3.2), which is a stated convention, and `walk`'s own skipArchives option already honours it.
  // Nothing else is waved through — not dotfiles either, following canon's own root-filing check,
  // whose probe records that "the set is named files, not a dotfile pass". A project that needs a
  // new root entry adds it to the standard, where the next reader can see it.
  //
  // NO SKIP CASE. If brief/ exists its root exists, so B-9 always has a subject; if brief/ is
  // absent the whole run returns at B-1. A check that cannot be vacuous should say so rather than
  // carry a skip branch nothing can reach.
  const strays = readdirSync(briefDir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("_"))
    .filter((e) => (e.isDirectory() ? !FOLDERS.includes(e.name) : !SPINE.includes(e.name)))
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
  add("B-9", strays.length === 0,
    strays.length
      ? `unfiled at brief/ root: ${strays.join(", ")} — move each into a role folder and index it, or add it to the spine in BRIEF-STANDARD §3`
      : `${SPINE.length} spine files + ${FOLDERS.filter((f) => existsSync(join(briefDir, f))).length} role folders, nothing unfiled`);

  return results;
}

// ── the generator ────────────────────────────────────────────────────────────

export function renderStatus(projectDir, opts = {}) {
  const briefDir = join(projectDir, "brief");
  const today = new Date().toISOString().slice(0, 10);
  const files = walk(briefDir).filter((f) => f.endsWith(".md")).sort();
  const results = checkBrief(projectDir, opts);

  const rows = files.map((f) => {
    const rel = relative(briefDir, f);
    const kb = (statSync(f).size / 1024).toFixed(1);
    const commit = lastCommit(join("brief", rel), projectDir) ?? "—";
    return `| \`${rel}\` | ${kb} KB | ${commit} |`;
  });

  const gates = read(join(briefDir, "GATES.md")) ?? "";
  const openRows = tableRows(gates.split(/^##\s+Closed/m)[0]).filter((r) => /^G-\d+/.test(r[0] ?? ""));
  const aged = openRows.map((r) => {
    const days = /^\d{4}-\d{2}-\d{2}$/.test(r[4] ?? "")
      ? Math.floor((Date.now() - Date.parse(r[4])) / 86400000) : null;
    return `| ${r[0]} | ${r[3]} | ${r[4]} | ${days === null ? "—" : `${days} d`} |`;
  });

  return `# Status

> **Generated by \`check-brief.mjs --status\` on ${today}. Do not hand-edit.**
>
> Anything a person owns lives in \`GATES.md\`. This file only reports what can be derived.

## Conformance

| Check | | |
|---|---|---|
${results.map((r) => `| ${r.id} | ${r.skipped ? "skipped" : r.ok ? "pass" : "FAIL"} | ${r.note} |`).join("\n")}

## Files

| File | Size | Last commit |
|---|---|---|
${rows.join("\n")}

## Open gates, by age

| id | Owner | Open since | Age |
|---|---|---|---|
${aged.length ? aged.join("\n") : "| — | — | — | — |"}
`;
}

// ── the probe ────────────────────────────────────────────────────────────────

const GOOD = {
  "brief/README.md": "# Brief\n\n| File | What it settles |\n|---|---|\n| `build/10-foundation.md` | a |\n",
  "brief/EVIDENCE.md": "# Evidence\n\n- **A fact.** — *source: somewhere*\n",
  "brief/DECISIONS.md": "# Decisions\n\n| Date | Decision |\n|---|---|\n| 2026-01-01 | **Did a thing.** Because. |\n",
  "brief/GATES.md": "# Gates\n\n| id | Blocked | The question | Owner | Open since | Closes when |\n|---|---|---|---|---|---|\n| G-01 | the page | which colour? | Stéan | 2026-01-01 | a colour is named |\n\n## Closed\n\n| id | Closed | Answer |\n|---|---|---|\n",
  "brief/CURRENT.md": "# Current\n\nOn step 3.\n",
  "brief/build/README.md": "# Build\n\n| File | |\n|---|---|\n| `10-foundation.md` | a |\n",
  "brief/build/10-foundation.md": "# Foundation\n\nProse.\n",
};

function fixture(files) {
  const root = join(tmpdir(), `brief-probe-${Math.random().toString(36).slice(2)}`);
  for (const [rel, body] of Object.entries(files)) {
    if (body === undefined) continue;   // a fixture removing a file GOOD ships
    const full = join(root, rel);
    // dirname(), not slice-to-the-last-slash. `join` emits the PLATFORM
    // separator, so on Windows there is no "/" in `full`, lastIndexOf returns
    // -1, slice(0, -1) drops the last CHARACTER, and mkdirSync creates
    // `brief\README.m` as a DIRECTORY beside the file. B-9 then reports every
    // fixture's own scaffolding as a stray and all six known-good cases fail —
    // on POSIX it passed silently, which is why it shipped.
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  // STATUS.md written last so B-6 is current in the good fixture.
  const s = join(root, "brief/STATUS.md");
  if (!files["brief/STATUS.md"]) writeFileSync(s, "# Status\n\ngenerated\n");
  return root;
}

function selftest() {
  const cases = [
    ["known-good passes", GOOD, null],
    ["B-1 missing spine file", omit(GOOD, "brief/EVIDENCE.md"), "B-1"],
    ["B-1 empty spine file", { ...GOOD, "brief/EVIDENCE.md": "   \n" }, "B-1"],
    ["B-2 document not indexed", { ...GOOD, "brief/build/20-ssot.md": "# S\n" }, "B-2"],
    ["B-2 index points at nothing", { ...GOOD, "brief/README.md": GOOD["brief/README.md"] + "| `build/99-gone.md` | x |\n" }, "B-2"],
    ["B-2 folder without a README", { ...GOOD, "brief/legal/PRIVACY.md": "# P\n" }, "B-2"],
    // ── v4 · B-2 and B-7 recurse. The KNOWN-GOODs come first and there are four of them,
    // because the risk in this change is not missing the gap — it is closing it so hard that a
    // legitimate tree fails. Every way a nested document can legitimately be indexed is probed.
    ["KNOWN-GOOD: a nested document indexed by its ROLE FOLDER README, cited relative to it",
      { ...GOOD, "brief/build/README.md": GOOD["brief/build/README.md"] + "| `artefacts/00-report.md` | a |\n",
        "brief/build/artefacts/00-report.md": "# R\n" }, null],
    ["KNOWN-GOOD: …or by the ROOT README, cited by its full path",
      { ...GOOD, "brief/README.md": GOOD["brief/README.md"] + "| `build/artefacts/00-report.md` | a |\n",
        "brief/build/artefacts/00-report.md": "# R\n" }, null],
    ["KNOWN-GOOD: …or by a README IN ITS OWN DIRECTORY, cited by filename",
      { ...GOOD, "brief/build/README.md": GOOD["brief/build/README.md"] + "| `artefacts/README.md` | i |\n",
        "brief/build/artefacts/README.md": "# A\n\n| File | |\n|---|---|\n| `00-report.md` | a |\n",
        "brief/build/artefacts/00-report.md": "# R\n" }, null],
    ["KNOWN-GOOD: an `_`-prefixed subdirectory is not walked at all — retained, not authoritative (§3.2)",
      { ...GOOD, "brief/build/_ADDENDUM/00-old.md": "# O\n", "brief/build/_ADDENDUM/01-older.md": "# O\n" }, null],
    ["B-2 a NESTED document indexed nowhere fires — the v3 hole, which reported `1 documents, all indexed`",
      { ...GOOD, "brief/build/artefacts/00-report.md": "# R\n" }, "B-2"],
    ["B-2 a folder README naming only the SUBDIRECTORY does not index its contents",
      { ...GOOD, "brief/build/README.md": GOOD["brief/build/README.md"] + "| `artefacts` | a folder |\n",
        "brief/build/artefacts/00-report.md": "# R\n" }, "B-2"],
    ["B-2 a dangling NESTED reference fires — the pattern must match a path, not just a filename",
      { ...GOOD, "brief/README.md": GOOD["brief/README.md"] + "| `build/artefacts/99-gone.md` | x |\n" }, "B-2"],
    ["B-7 two nested documents claim one band IN THE SAME DIRECTORY",
      { ...GOOD, "brief/build/README.md": GOOD["brief/build/README.md"] + "| `artefacts/00-a.md` | a |\n| `artefacts/00-b.md` | b |\n",
        "brief/build/artefacts/00-a.md": "# A\n", "brief/build/artefacts/00-b.md": "# B\n" }, "B-7"],
    ["KNOWN-GOOD: the same band in a PARENT and a CHILD directory is not a collision — a band orders documents within the directory that holds them",
      { ...GOOD, "brief/build/README.md": GOOD["brief/build/README.md"] + "| `00-x.md` | x |\n| `artefacts/00-a.md` | a |\n",
        "brief/build/00-x.md": "# X\n", "brief/build/artefacts/00-a.md": "# A\n" }, null],
    ["B-7 two documents claim band 10", { ...GOOD, "brief/build/README.md": GOOD["brief/build/README.md"] + "| `10-other.md` | b |\n", "brief/build/10-other.md": "# O\n" }, "B-7"],
    ["B-8 CURRENT.md over its ceiling", { ...GOOD, "brief/CURRENT.md": "# Current\n\n" + "x".repeat(9000) }, "B-8"],
    ["B-8 a reserved status name exists", { ...GOOD, "brief/build/NOW.md": "# Now\n" }, "B-8"],
    ["B-3 gate with no owner", { ...GOOD, "brief/GATES.md": GOOD["brief/GATES.md"].replace("| Stéan |", "|  |") }, "B-3"],
    ["B-3 gate owned by 'the team'", { ...GOOD, "brief/GATES.md": GOOD["brief/GATES.md"].replace("Stéan", "the team") }, "B-3"],
    ["B-3 gate with a bad date", { ...GOOD, "brief/GATES.md": GOOD["brief/GATES.md"].replace("2026-01-01", "January") }, "B-3"],
    ["B-4 log over the row limit", { ...GOOD, "brief/DECISIONS.md": bigLog(ROTATE_ROWS + 1) }, "B-4"],
    ["B-6 STATUS older than a document", GOOD, "B-6", { touchAfter: "brief/build/10-foundation.md" }],

    // ── vacuity: an absent subject must SKIP, never pass ────────────────────
    ["B-2 skips with no role folder", omit(omit(GOOD, "brief/build/README.md"), "brief/build/10-foundation.md"), { skip: "B-2" }],
    ["B-3 skips with no GATES.md", omit(GOOD, "brief/GATES.md"), { skip: "B-3" }],
    ["B-4 skips with no DECISIONS.md", omit(GOOD, "brief/DECISIONS.md"), { skip: "B-4" }],
    ["B-7 skips with nothing numbered", omit(omit(GOOD, "brief/build/README.md"), "brief/build/10-foundation.md"), { skip: "B-7" }],
    ["B-8 skips with no session-start file", omit(GOOD, "brief/CURRENT.md"), { skip: "B-8" }],

    // ── and the opposite: PRESENT but empty is judged, not skipped ──────────
    ["B-3 judges an empty-but-present GATES.md", { ...GOOD, "brief/GATES.md": "# Gates\n\n| id | Blocked | The question | Owner | Open since | Closes when |\n|---|---|---|---|---|---|\n" }, { judged: "B-3" }],
    ["B-4 judges an empty-but-present DECISIONS.md", { ...GOOD, "brief/DECISIONS.md": "# Decisions\n\n| Date | Decision |\n|---|---|\n" }, { judged: "B-4" }],
    ["B-5 ignores a marker inside a _SUPERSEDED_ archive", { ...GOOD, "brief/build/_SUPERSEDED_INDEX.md": "# Old\n\n[TO CONFIRM: settled long ago]\n" }, null],

    // ── B-9 · the root, which nothing governed until 2026-09-09 ─────────────
    ["B-9 a document parked at brief/ root fires", { ...GOOD, "brief/INTAKE_REPORT.md": "# Intake\n\nfindings nothing links.\n" }, "B-9"],
    ["B-9 a stray DIRECTORY at brief/ root fires", { ...GOOD, "brief/scratch/x.md": "# x\n" }, "B-9"],
    ["B-9 an unclassified dotfile at brief/ root fires — the set is named entries, not a dotfile pass", { ...GOOD, "brief/.notes.md": "# n\n" }, "B-9"],
    ["B-9 KNOWN-GOOD: a _SUPERSEDED_ file at root passes — retained-but-not-authoritative (§3.2)", { ...GOOD, "brief/_SUPERSEDED_PLAN.md": "# Old plan\n" }, null],
    ["B-9 KNOWN-GOOD: the conformant spine has nothing unfiled", GOOD, null],
    // ── B-7 · the false zero pleks found, 2026-09-09 ────────────────────────
    // The KNOWN-GOOD is listed first because the defect was a PASS, not a failure: a check whose
    // pattern matched nothing announced "no collisions" and read as clean. What must be probed is
    // that an unreadable name is now visible, and that a run which read nothing is not a pass.
    ["B-7 KNOWN-GOOD: two documents with different numbers do not collide",
      { ...GOOD, "brief/build/README.md": "# Build\n\n| File | |\n|---|---|\n| `10-foundation.md` | a |\n| `07-alpha.md` | a |\n| `08-beta.md` | b |\n",
        "brief/build/07-alpha.md": "# a\n", "brief/build/08-beta.md": "# b\n" }, null],
    ["B-7 the same number twice still fires",
      { ...GOOD, "brief/build/07-alpha.md": "# a\n", "brief/build/07-beta.md": "# b\n" }, "B-7"],
    ["B-7 names it CANNOT read are named in the note rather than dropped — the pleks ADDENDUM_ case",
      { ...GOOD, "brief/build/README.md": "# Build\n\n| File | |\n|---|---|\n| `10-foundation.md` | a |\n| `07-alpha.md` | a |\n| `ADDENDUM_00A_x.md` | x |\n",
        "brief/build/07-alpha.md": "# a\n", "brief/build/ADDENDUM_00A_x.md": "# x\n" }, null,
      { expectNote: /CANNOT READ/ }],
    ["B-7 a tree where NOTHING parsed is reported skipped, not passed — the false zero itself",
      { ...GOOD,
        "brief/README.md": "# Brief\n\n| File | What it settles |\n|---|---|\n| `build/ADDENDUM_00A_x.md` | x |\n",
        "brief/build/README.md": "# Build\n\n| File | |\n|---|---|\n| `ADDENDUM_00A_x.md` | x |\n| `ADDENDUM_00I_y.md` | y |\n",
        "brief/build/10-foundation.md": undefined,
        "brief/build/ADDENDUM_00A_x.md": "# x\n", "brief/build/ADDENDUM_00I_y.md": "# y\n" }, null,
      { expectSkipped: "B-7", expectNote: /CANNOT READ/ }],
  ];

  let failures = 0;
  for (const [name, files, expect, opts = {}] of cases) {
    const root = fixture(files);
    if (opts.touchAfter) {
      const p = join(root, opts.touchAfter);
      writeFileSync(p, read(p) + "\nmore\n");
      // `utimesSync`, not `touch -d`. Windows has no `touch`, so the shell-out threw and the catch
      // shrugged that the mtime "is already newer" — but B-6 allows a 1000ms tolerance and the
      // rewrite lands in the same second, so it was NOT newer, B-6 did not fire, and the probe
      // reported the check broken on the one host where the check was fine. A fixture that reaches
      // for a POSIX binary to set up a Windows-visible fact is the same one-artefact-two-platforms
      // defect as `dirname` above, wearing test clothes. Node sets mtimes on both.
      const when = new Date(Date.now() + 5000);
      utimesSync(p, when, when);
    }
    const res = checkBrief(root);
    // Two assertions beyond "did the right id fire", because this defect was a PASS with a lying
    // note. A verdict alone cannot distinguish a check that measured its subject from one that
    // matched nothing, which is the whole of L-01.
    if (opts.expectNote || opts.expectSkipped) {
      const row = res.find((r) => r.id === (opts.expectSkipped ?? "B-7"));
      if (opts.expectNote && !opts.expectNote.test(row?.note ?? "")) {
        failures++;
        console.log(`  ✗ ${name} — note did not match ${opts.expectNote}: ${row?.note ?? "(no row)"}`);
        continue;
      }
      if (opts.expectSkipped && !row?.skipped) {
        failures++;
        console.log(`  ✗ ${name} — ${opts.expectSkipped} was not reported skipped`);
        continue;
      }
    }
    const failed = res.filter((r) => !r.ok && !r.skipped).map((r) => r.id);
    const skipped = res.filter((r) => r.skipped).map((r) => r.id);
    let ok, want;
    if (expect === null) { ok = failed.length === 0; want = "no failures"; }
    else if (typeof expect === "object" && expect.skip) {
      // The vacuity direction: subject absent must SKIP, never pass.
      ok = skipped.includes(expect.skip); want = `${expect.skip} skipped`;
    } else if (typeof expect === "object" && expect.judged) {
      // The other direction: subject PRESENT but empty is judged, not skipped.
      ok = !skipped.includes(expect.judged) && !failed.includes(expect.judged);
      want = `${expect.judged} judged (present but empty)`;
    } else { ok = failed.includes(expect); want = expect; }
    console.log(`  ${ok ? "✓" : "✗"} ${name}${ok ? "" : ` — expected ${want}, got failed[${failed.join(", ")}] skipped[${skipped.join(", ")}]`}`);
    if (!ok) failures++;
    rmSync(root, { recursive: true, force: true });
  }

  // The direction that matters most: B-5 must report SKIPPED, not PASSED,
  // when it has not been asked to gate.
  const root = fixture({ ...GOOD, "brief/EVIDENCE.md": "# E\n\n[TO CONFIRM: a thing]\n" });
  const lax = checkBrief(root).find((r) => r.id === "B-5");
  const strict = checkBrief(root, { strictMarkers: true }).find((r) => r.id === "B-5");
  const b5ok = lax.skipped === true && strict.ok === false;
  console.log(`  ${b5ok ? "✓" : "✗"} B-5 reports skipped by default and fails under --strict-markers`);
  if (!b5ok) failures++;
  rmSync(root, { recursive: true, force: true });

  // ── --status, SPAWNED ──────────────────────────────────────────────────────────────────────
  // The defect pleks reported was in the CLI's ORDERING, not in renderStatus, so no in-process call
  // can see it: renderStatus was always correct about the tree it was handed. Only running the
  // entry point the way the gate runs it exercises the bug (L-51).
  {
    const root = fixture(GOOD);
    const status = join(root, "brief", "STATUS.md");
    rmSync(status, { force: true });                       // the tree a first --status run meets
    execFileSync(process.execPath, [SELF, root, "--status"], { stdio: "pipe" });
    const txt = readFileSync(status, "utf8");
    const lies = /STATUS\.md/.test(txt) && /(missing|absent|empty)/i.test(txt);
    if (lies) failures++;
    console.log(`  ${lies ? "✗" : "✓"} --status writes a STATUS.md that does not assert its own absence`);
    const stale = /\(generating/.test(txt);
    if (stale) failures++;
    console.log(`  ${stale ? "✗" : "✓"} …and the placeholder never survives into the finished document`);
    rmSync(root, { recursive: true, force: true });
  }

  console.log(failures === 0 ? "\nselftest: all probes green (both directions)" : `\nselftest: ${failures} probe(s) wrong`);
  return failures === 0 ? 0 : 1;
}

const omit = (obj, key) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
const bigLog = (n) =>
  "# Decisions\n\n| Date | Decision |\n|---|---|\n" +
  Array.from({ length: n }, (_, i) => `| 2026-01-${String((i % 28) + 1).padStart(2, "0")} | **Row ${i}.** Why. |`).join("\n") + "\n";

// ── entry ────────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
if (argv.includes("--selftest")) process.exit(selftest());

const dir = argv.find((a) => !a.startsWith("--")) ?? ".";
if (!existsSync(join(dir, "brief"))) {
  console.error(`check-brief: no brief/ under ${dir}`);
  process.exit(2);
}

const strict = { strictMarkers: argv.includes("--strict-markers") };

// STATUS.md IS WRITTEN BEFORE ANYTHING IS MEASURED, and that ordering is the fix rather than an
// optimisation. Reported by pleks 2026-09-09: `--status` measured conformance and THEN wrote the
// file, so on a tree where STATUS.md did not yet exist the generated document contained a row
// asserting that STATUS.md was missing — a generated artefact stating something its own existence
// disproves, and a reader has no way to tell that row from a true one.
//
// A placeholder goes down first so the tree the report describes is the tree that will exist when
// anyone reads it. It is non-empty because B-1 requires non-empty, and it is overwritten in the
// same breath; the window in which it is visible is microseconds and a crash inside it leaves an
// obviously unfinished file rather than a plausible wrong one.
if (argv.includes("--status")) {
  const out = join(dir, "brief", "STATUS.md");
  if (!existsSync(out)) writeFileSync(out, "# Status\n\n(generating — check-brief.mjs --status did not finish)\n");
  writeFileSync(out, renderStatus(dir, strict));
  console.log("wrote brief/STATUS.md\n");
}

// Measured AFTER the generator, so the verdict on screen describes the same tree as the document.
const results = checkBrief(dir, strict);
for (const r of results) {
  const tag = r.skipped ? "· skipped" : r.ok ? "✓ pass   " : "✗ FAIL   ";
  console.log(`${tag} ${r.id}  ${r.note}`);
}

const failed = results.filter((r) => !r.ok && !r.skipped);
const skipped = results.filter((r) => r.skipped);
// A run that is mostly skipped is not a healthy run, and the last line is the
// only part most readers see.
const tail = skipped.length ? ` · ${skipped.length} of ${results.length} not measured` : "";
console.log(failed.length
  ? `\nbrief: ${failed.length} check(s) failed${tail}`
  : `\nbrief: conformant${tail}`);
process.exit(failed.length ? 1 : 0);
