#!/usr/bin/env node
// @kit check-install-platform v2 — tracked. Edit it in dev-standards and re-adopt; a local
// change is a fork, and the next project starts from the worse version without knowing it.
/**
 * Is `node_modules` built for the machine that is about to run it?
 *
 * THE MECHANISM FOR L-80. `npm install` is not a download, it is a BUILD for the current platform,
 * and two of its outputs are chosen from `process.platform` at the moment it runs:
 *
 *   node_modules/.bin      POSIX gets extensionless SYMLINKS; Windows gets .cmd and .ps1 SHIMS
 *   native optional deps   @oxc-parser/binding-linux-x64-gnu vs binding-win32-x64-msvc, and so on
 *
 * Neither is visible in package.json, in the lock, or in the install's own output — the lock is
 * platform-neutral by construction and lists every variant, so it cannot tell you which one was
 * materialised. The failure therefore surfaces a long way from its cause, as `'x' is not recognized
 * as an internal or external command`, or as a module that resolves and will not load.
 *
 * WHY A CHECK AND NOT A NOTE. A repo worked on from two platforms against ONE tree — a VM mount, a
 * Docker volume, WSL against a Windows drive, a network share, a dev container — has this exposure
 * permanently, and the recovery is one command (`npm ci`). What is expensive is not the recovery,
 * it is the ten minutes spent reading a confusing error before remembering the recovery exists.
 * Written 2026-09-09, the day it cost exactly that twice.
 *
 * IT REPORTS SKIPPED RATHER THAN GREEN when it cannot tell, and that matters more here than usual:
 * every signal it reads is an ARTEFACT of an install, so an absent or unrecognisable tree means it
 * measured nothing. A check that passes when its subject is absent is a defect.
 *
 * Run: node scripts/check-install-platform.mjs [<projectDir>] [--selftest]
 */
import { existsSync, readdirSync, lstatSync, mkdirSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Read the shape of `node_modules/.bin` and say which platform wrote it.
 *
 * Two signals, deliberately, because either alone is defeatable: a POSIX tree with no executables
 * has an empty `.bin`, and a Windows tree can contain extensionless files that are not symlinks.
 * `shims` and `links` are both returned so the caller can say WHY rather than only what.
 */
export function readBinShape(binDir, fs = { existsSync, readdirSync, lstatSync }) {
  if (!fs.existsSync(binDir)) return { platform: null, why: "no node_modules/.bin", shims: 0, links: 0 };
  let names;
  try { names = fs.readdirSync(binDir); } catch { return { platform: null, why: "node_modules/.bin is unreadable", shims: 0, links: 0 }; }

  const shims = names.filter((n) => n.endsWith(".cmd") || n.endsWith(".ps1")).length;
  let links = 0;
  for (const n of names) {
    if (n.endsWith(".cmd") || n.endsWith(".ps1")) continue;
    try { if (fs.lstatSync(join(binDir, n)).isSymbolicLink()) links++; } catch { /* raced or unreadable */ }
  }

  if (shims === 0 && links === 0) return { platform: null, why: "node_modules/.bin holds neither shims nor symlinks", shims, links };
  if (shims > 0 && links === 0) return { platform: "win32", why: `${shims} .cmd/.ps1 shim(s)`, shims, links };
  if (links > 0 && shims === 0) return { platform: "posix", why: `${links} symlink(s)`, shims, links };
  return { platform: null, why: `both shapes present (${shims} shims, ${links} symlinks) — a tree installed twice`, shims, links };
}

/** `win32` and everything else. npm's .bin shape splits exactly here, so the check does too. */
export const familyOf = (p) => (p === "win32" ? "win32" : "posix");

export function verdict({ shape, platform }) {
  if (shape.platform === null) return { level: "skip", msg: `cannot tell which platform installed node_modules — ${shape.why}` };
  const want = familyOf(platform);
  if (shape.platform === want) return { level: "ok", msg: `node_modules matches this platform (${want}, ${shape.why})` };
  return {
    level: "fail",
    msg:
      `node_modules was installed on ${shape.platform} and this is ${want} — ${shape.why}. ` +
      `The .bin entries and every native binding were chosen for the other machine, so commands ` +
      `will report "not found" and native modules will not load. Recover with \`npm ci\`, which ` +
      `rebuilds the platform half from the lock. (L-80)`,
  };
}

/* ── probes ──────────────────────────────────────────────────────────────────────────── */

function selftest() {
  let failed = 0;
  const ok = (cond, label) => {
    if (!cond) failed++;
    console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  };

  // Fixtures go to disk and travel the real discovery path — a hand-built object would prove the
  // predicate and not the reader, and the reader is where the platform difference actually lives.
  const root = mkdtempSync(join(tmpdir(), "install-probe-"));
  const mk = (name, build) => {
    const d = join(root, name, ".bin");
    mkdirSync(d, { recursive: true });
    build(d);
    return d;
  };

  const winBin = mk("win", (d) => {
    writeFileSync(join(d, "eslint.cmd"), "@echo off\n");
    writeFileSync(join(d, "eslint.ps1"), "#\n");
    writeFileSync(join(d, "eslint"), "#!/bin/sh\n");        // npm writes this too, as a plain file
  });
  const posixBin = mk("posix", (d) => {
    writeFileSync(join(root, "posix", "target.js"), "//\n");
    symlinkSync(join("..", "target.js"), join(d, "eslint"));
  });
  const emptyBin = mk("empty", () => {});
  const bothBin = mk("both", (d) => {
    writeFileSync(join(root, "both", "target.js"), "//\n");
    symlinkSync(join("..", "target.js"), join(d, "eslint"));
    writeFileSync(join(d, "knip.cmd"), "@echo off\n");
  });

  ok(readBinShape(winBin).platform === "win32", "a .bin of .cmd/.ps1 shims reads as win32");
  ok(readBinShape(posixBin).platform === "posix", "a .bin of symlinks reads as posix");
  ok(readBinShape(emptyBin).platform === null, "an empty .bin is UNKNOWN, not a pass — it is an install artefact and there is none");
  ok(readBinShape(join(root, "nope", ".bin")).platform === null, "an absent .bin is UNKNOWN — no node_modules means nothing was measured");
  ok(readBinShape(bothBin).platform === null, "both shapes at once is UNKNOWN and says so — a tree installed twice is not a tree to trust");

  // A plain (non-symlink) extensionless file must not be counted as a POSIX link, or every Windows
  // tree would read as ambiguous: npm writes an extensionless shell script beside its .cmd shim.
  ok(readBinShape(winBin).links === 0, "…and the extensionless shell script npm writes on Windows is not miscounted as a symlink");

  ok(verdict({ shape: readBinShape(winBin), platform: "win32" }).level === "ok", "KNOWN-GOOD: a win32 tree on win32 passes");
  ok(verdict({ shape: readBinShape(posixBin), platform: "linux" }).level === "ok", "KNOWN-GOOD: a posix tree on linux passes");
  ok(verdict({ shape: readBinShape(posixBin), platform: "darwin" }).level === "ok", "…and on darwin — the split is win32 vs the rest, not per-OS");

  const crossed = verdict({ shape: readBinShape(posixBin), platform: "win32" });
  ok(crossed.level === "fail", "a posix tree on win32 FAILS — the incident that produced this file");
  ok(/npm ci/.test(crossed.msg), "…and names the recovery, because the cost is the ten minutes before remembering it");
  ok(verdict({ shape: readBinShape(winBin), platform: "linux" }).level === "fail", "a win32 tree on linux fails too — it is symmetric");
  ok(verdict({ shape: readBinShape(emptyBin), platform: "linux" }).level === "skip", "an unreadable tree is SKIPPED, never passed");

  rmSync(root, { recursive: true, force: true });
  console.log(failed ? `\n❌ ${failed} probe(s) wrong` : "\n✅ probes green — reads both tree shapes, fails both crossings, and skips rather than passes when it cannot tell");
  process.exit(failed ? 1 : 0);
}

if (process.argv.includes("--selftest")) selftest();
else {
  // The project dir is an ARGUMENT, on check-brief's convention, because `..` from `scripts/` is
  // the project root only once this file is INSTALLED. Inside canon it sits at
  // `kit/project-kit/scripts/`, where `..` is the kit — and the first live run duly reported "no
  // node_modules" about a repo that has one. A kit script that assumes its installed depth is a
  // script canon cannot run on itself, which is how canon stops exercising what it ships.
  const dir = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? join(HERE, "..");
  const shape = readBinShape(join(dir, "node_modules", ".bin"));
  const v = verdict({ shape, platform: process.platform });
  const icon = { ok: "📦", skip: "⊘", fail: "❌" }[v.level];
  console.log(`${icon} install-platform: ${v.msg}`);
  process.exit(v.level === "fail" ? 1 : 0);
}
