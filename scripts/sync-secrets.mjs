/**
 * scripts/sync-secrets.mjs — carry the git-ignored files between machines.
 *
 * Git syncs the code; it deliberately does NOT carry `.env.local`, `.env` or
 * `.claude/settings.local.json`. Those are the only things that genuinely need a
 * file-sync, and they are small — so they live in OneDrive and this script moves
 * them in or out of the working copy.
 *
 * The repo itself is NOT in OneDrive, on purpose: syncing `.git` and
 * `node_modules` (thousands of tiny files, cloud placeholders that fail mmap, two
 * machines writing pack files independently) corrupted both on 2026-08-17 — 118
 * unreadable git objects and an unusable node_modules.
 *
 *   node scripts/sync-secrets.mjs pull    # OneDrive -> this working copy
 *   node scripts/sync-secrets.mjs push    # this working copy -> OneDrive
 *   node scripts/sync-secrets.mjs status  # compare, change nothing
 *
 * Override the store with LT_SECRETS_DIR if OneDrive sits elsewhere on a machine.
 */
import { existsSync, mkdirSync, copyFileSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const STORE =
  process.env.LT_SECRETS_DIR ??
  join(homedir(), "OneDrive", "dev-secrets", "life-therapy");

/** [pathInRepo, nameInStore] */
const FILES = [
  [".env.local", ".env.local"],
  [".env", ".env"],
  [join(".claude", "settings.local.json"), "settings.local.json"],
];

const mode = process.argv[2] ?? "status";
if (!["pull", "push", "status"].includes(mode)) {
  console.error(`Unknown mode "${mode}". Use pull, push or status.`);
  process.exit(1);
}

if (!existsSync(STORE)) {
  if (mode === "pull") {
    console.error(`Secrets store not found: ${STORE}`);
    console.error("Is OneDrive signed in on this machine? Or set LT_SECRETS_DIR.");
    process.exit(1);
  }
  mkdirSync(STORE, { recursive: true });
}

const digest = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);
const when = (p) => (existsSync(p) ? statSync(p).mtime.toISOString().slice(0, 16).replace("T", " ") : "—");

let changed = 0;
for (const [repoRel, storeName] of FILES) {
  const repoPath = join(process.cwd(), repoRel);
  const storePath = join(STORE, storeName);
  const a = digest(repoPath);
  const b = digest(storePath);

  if (mode === "status") {
    let state;
    if (a === null && b === null) state = "missing both sides";
    else if (a === null) state = "only in OneDrive — run `pull`";
    else if (b === null) state = "only here — run `push`";
    else state = a === b ? "in sync" : `DIFFERENT (here ${when(repoPath)}, store ${when(storePath)})`;
    console.log(`  ${repoRel.padEnd(30)} ${state}`);
    continue;
  }

  const [from, to] = mode === "pull" ? [storePath, repoPath] : [repoPath, storePath];
  if (!existsSync(from)) {
    console.log(`  skip ${repoRel} — nothing to copy from ${mode === "pull" ? "OneDrive" : "here"}`);
    continue;
  }
  if (a !== null && b !== null && a === b) {
    console.log(`  ok   ${repoRel} — already identical`);
    continue;
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  changed++;
  console.log(`  ${mode === "pull" ? "pulled" : "pushed"} ${repoRel}`);
}

if (mode !== "status") {
  console.log(`\n${changed} file(s) ${mode === "pull" ? "pulled from" : "pushed to"} ${STORE}`);
}
