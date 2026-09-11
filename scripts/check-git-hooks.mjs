#!/usr/bin/env node
/**
 * scripts/check-git-hooks.mjs — probes for the commit and push gates.
 *
 * A git hook has four independent ways to be decorative, and NOTHING about the file itself reveals
 * any of them:
 *   1. it exists and is executable (as git records it — not as this filesystem reports it)
 *   2. `core.hooksPath` actually points at the directory holding it; a hook in an unreferenced
 *      directory is a file, not a gate
 *   3. it BLOCKS (non-zero exit) when the command it wraps fails, and passes when it succeeds
 *   4. its test seam is INERT without the probe flag — otherwise the seam is `--no-verify` wearing
 *      a probe's clothes, and the gate can be turned off by one environment variable
 *
 * (3) and (4) are driven through the real hook files as real processes, via the LT_*_CMD seam,
 * rather than by running the actual multi-minute chain: the property under test is "does a failure
 * propagate", not "does the suite pass", and conflating them makes this probe too slow to run and
 * therefore not run.
 *
 * Ported from pleks/scripts/check-git-hooks.mjs. The rebase-carve-out block at the end is new here,
 * for the divergence documented in .githooks/prepare-commit-msg.
 */
import { existsSync, statSync, writeFileSync, rmSync, mkdtempSync, mkdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const HOOKS = [
  { file: ".githooks/pre-commit", env: "LT_PRECOMMIT_CMD", cmd: "npm run check" },
  // A push also runs the production build: a push is when Vercel builds, and nothing else here walks
  // the client bundle graph. From 2026-08-19 to 2026-09-11 every deploy failed on an error only
  // `next build` could see, while every gate here passed.
  { file: ".githooks/pre-push", env: "LT_PREPUSH_CMD", cmd: "npm run check:push" },
  // Git does NOT run pre-commit for a merge; it runs pre-merge-commit. Without this hook the commit
  // gate had a hole the size of every merge commit.
  { file: ".githooks/pre-merge-commit", env: "LT_PRECOMMIT_CMD", cmd: "npm run check" },
  // Measured 2026-08-21: `git cherry-pick` and `git revert` run NEITHER pre-commit NOR
  // pre-merge-commit. They do run prepare-commit-msg, which is therefore the gate for every
  // commit-creating path git does not otherwise cover — including whichever one is added next.
  { file: ".githooks/prepare-commit-msg", env: "LT_PRECOMMIT_CMD", cmd: "npm run check" },
]

let failed = 0
const ok = (cond, label) => {
  if (!cond) failed++
  console.log(`  ${cond ? "✓" : "✗"} ${label}`)
}

// pre-commit and pre-merge-commit record the tree they approved so prepare-commit-msg can tell "the
// gate already ran for this commit" from "no gate ran". Every probe that drives one of them
// successfully therefore WRITES that marker — and a later probe of prepare-commit-msg would consume
// it and skip, reporting the gate inert as if by design. Each direction clears it first, so no
// probe inherits another's state.
const markerPath = () =>
  spawnSync("git", ["rev-parse", "--git-path", "lt-gate-ok"], { encoding: "utf8" }).stdout.trim()
const clearMarker = () => {
  try {
    rmSync(markerPath(), { force: true })
  } catch {
    /* nothing to clear */
  }
}

// 2 — the wiring. Checked first: if this is wrong, every hook below is an inert file.
// `npm run prepare` sets it, and npm runs `prepare` on `npm ci`, so a fresh clone is wired by the
// install the setup script already performs.
const configured = spawnSync("git", ["config", "core.hooksPath"], { encoding: "utf8" }).stdout.trim()
ok(
  configured === ".githooks",
  `core.hooksPath is .githooks (got "${configured || "unset"}") — without this the hooks never run`,
)

for (const { file, env } of HOOKS) {
  ok(existsSync(file), `${file} exists`)
  if (!existsSync(file)) continue

  // On a Windows checkout the filesystem mode bit is not meaningful, but it IS what git records and
  // what a POSIX clone will honour — so assert what git has staged, not what this disk reports.
  const mode = spawnSync("git", ["ls-files", "-s", file], { encoding: "utf8" }).stdout.trim()
  ok(
    mode === "" || mode.startsWith("100755"),
    `${file} is executable in git (${mode.split(" ")[0] || "untracked yet"})`,
  )

  ok(statSync(file).size > 0, `${file} is not empty`)

  // 3 — both directions, through the real hook, as a real process.
  const run = (cmd) => {
    clearMarker()
    return spawnSync("sh", [file], {
      encoding: "utf8",
      env: { ...process.env, LT_HOOK_PROBE: "1", [env]: cmd },
    }).status
  }
  ok(run("false") !== 0, `${file} BLOCKS when the chain fails`)
  ok(run("true") === 0, `${file} passes when the chain succeeds`)
}

// The marker's PRODUCER side. Added after a mutation test: deleting the `git write-tree` line from
// pre-commit left every probe below green, because they all supply the marker themselves. The result
// is not an unsafe gate — it is a gate that runs the whole chain TWICE on every ordinary commit
// (pre-commit, then prepare-commit-msg finding nothing), which is the kind of defect that gets
// blamed on "the gate is slow" and fixed by turning it off.
for (const file of [".githooks/pre-commit", ".githooks/pre-merge-commit"]) {
  const tree = spawnSync("git", ["write-tree"], { encoding: "utf8" }).stdout.trim()
  const drive = (cmd) => {
    clearMarker()
    spawnSync("sh", [file], {
      encoding: "utf8",
      env: { ...process.env, LT_HOOK_PROBE: "1", LT_PRECOMMIT_CMD: cmd },
    })
    return existsSync(markerPath())
      ? spawnSync("cat", [markerPath()], { encoding: "utf8" }).stdout.trim()
      : null
  }
  ok(drive("true") === tree, `${file}: writes a marker naming the tree it approved`)
  // The other direction, and the one that matters: a FAILED gate must not leave a marker behind, or
  // the next cherry-pick would consume a pass that was never earned.
  ok(drive("false") === null, `${file}: writes NO marker when the chain fails`)
}
clearMarker()

// The marker's own contract, all four directions — it is what makes prepare-commit-msg the gate for
// cherry-pick and revert WITHOUT double-running the chain on an ordinary commit.
{
  const HOOK = ".githooks/prepare-commit-msg"
  let lastOut = ""
  const drive = (cmd) => {
    const r = spawnSync("sh", [HOOK], {
      encoding: "utf8",
      env: { ...process.env, LT_HOOK_PROBE: "1", LT_PRECOMMIT_CMD: cmd },
    })
    lastOut = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim()
    return r.status
  }

  clearMarker()
  ok(drive("false") !== 0, `${HOOK}: with NO marker it runs the gate — the cherry-pick/revert path`)

  // A marker naming THIS tree means pre-commit already approved it: skip, even though the gate fails.
  const tree = spawnSync("git", ["write-tree"], { encoding: "utf8" }).stdout.trim()
  writeFileSync(markerPath(), tree)
  const skipped = drive("false") === 0
  ok(
    skipped,
    `${HOOK}: a marker for THIS tree skips the gate — no double run on a plain commit${
      skipped ? "" : `\n      marker=${tree} at ${markerPath()}; hook said: ${lastOut}`
    }`,
  )

  // …and it is consumed, so a second commit cannot ride the same pass.
  ok(drive("false") !== 0, `${HOOK}: the marker is consumed — a second commit does not inherit it`)

  // A marker for a DIFFERENT tree is the aborted-commit case: it must not be honoured.
  writeFileSync(markerPath(), "0".repeat(40))
  ok(
    drive("false") !== 0,
    `${HOOK}: a marker for a DIFFERENT tree is ignored — an aborted commit cannot donate its pass`,
  )
  clearMarker()
}

// 4 — the seam must be INERT without the probe flag.
//
// The pleks original tested this by GREPPING the hook source for the flag's name. That is not a
// probe of behaviour: it passes on a hook whose two conditions are ORed rather than ANDed, on one
// that reads the flag and ignores the result, and on any rewrite that keeps the words and loses the
// logic. Behavioural instead, and cheap: every hook ECHOES the command it resolved before running
// it, so run it with the seam set and the flag ABSENT and read what it named.
//
// ⚠ AND THE HOOK MUST NOT ACTUALLY RUN THAT CHAIN. `npm run check` runs THIS SCRIPT, so a hook that
// really invoked it would re-enter the suite it lives in — pleks measured that as 58 orphaned node
// processes and a ten-minute hang, because killing the shell does not reach its descendants on
// Windows. So `npm` is SHIMMED on PATH: the hook resolves and invokes `npm run check` for real, and
// the npm it reaches prints and exits 0. Nothing recurses, and the property under test — which
// command did the hook RESOLVE, and did it actually invoke it — is exactly what is observed.
{
  const shimDir = mkdtempSync(join(tmpdir(), "lt-hookshim-"))
  writeFileSync(join(shimDir, "npm"), '#!/bin/sh\necho "SHIM npm $*"\nexit 0\n', { mode: 0o755 })

  for (const { file, env, cmd } of HOOKS) {
    clearMarker()
    const withFlag = spawnSync("sh", [file], {
      encoding: "utf8",
      env: { ...process.env, LT_HOOK_PROBE: "1", [env]: "true" },
    }).status
    ok(withFlag === 0, `${file}: the command seam is honoured WITH LT_HOOK_PROBE=1`)

    clearMarker()
    const noFlag = spawnSync("sh", [file], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${shimDir}:${process.env.PATH}`,
        LT_HOOK_PROBE: "",
        [env]: "echo SEAM-LEAKED",
      },
    })
    const out = String(noFlag.stdout ?? "")
    // Take the LAST arrow line: prepare-commit-msg prints an explanatory line first, and every
    // hook's final echo before running is the command it resolved.
    const arrows = out.split(/\r?\n/).filter((l) => l.includes("→"))
    const resolved = (arrows.at(-1) ?? "").replace(/^.*→\s*/, "").trim()
    ok(
      resolved === cmd && !out.includes("SEAM-LEAKED"),
      `${file}: …and IGNORED without it — resolved "${resolved || "(no output)"}"`,
    )
    // The shim must actually have been reached, or the assertion above is about an echo and nothing
    // else — a hook could resolve the right string and invoke something different.
    ok(out.includes(`SHIM ${cmd}`), `${file}: …and INVOKED it — the shimmed npm was reached`)
  }
  rmSync(shimDir, { recursive: true, force: true })
}

// ── The rebase carve-out, both directions ────────────────────────────────────────────────────────
//
// prepare-commit-msg skips when a rebase is in progress, because a rebase fires it once per replayed
// commit against intermediate trees that are not meant to be green (measured — see that file). That
// carve-out is the one part of this tier that makes the gate deliberately quieter, so it is the part
// most worth probing in the direction that says it does not skip anything else.
//
// ⚠ RUN IN A THROWAWAY REPO, NEVER THIS ONE. The condition is the presence of `.git/rebase-merge`,
// and creating that directory in a live repo tells git a rebase is in progress; a crash between
// create and remove would leave this checkout in a state whose recovery is `git rebase --abort` on
// a rebase that never existed. A temp repo makes the blast radius a directory nobody will miss, and
// the hook is invoked BY ABSOLUTE PATH with cwd set there, so it is the real file being driven.
{
  const HOOK = resolve(".githooks/prepare-commit-msg")
  const repo = mkdtempSync(join(tmpdir(), "lt-rebaselab-"))
  const git = (...args) => spawnSync("git", args, { cwd: repo, encoding: "utf8" })
  try {
    git("init", "-q", ".")
    git("config", "user.email", "probe@local")
    git("config", "user.name", "probe")
    writeFileSync(join(repo, "f.txt"), "x\n")
    git("add", ".")
    git("commit", "-qm", "base")

    const drive = () =>
      spawnSync("sh", [HOOK], {
        cwd: repo,
        encoding: "utf8",
        env: { ...process.env, LT_HOOK_PROBE: "1", LT_PRECOMMIT_CMD: "false" },
      })

    // No rebase in progress and no marker: the gate must RUN, and here it fails.
    const normal = drive()
    ok(
      normal.status !== 0,
      "prepare-commit-msg: with no rebase in progress it still runs the gate — the carve-out is not a blanket skip",
    )

    for (const dir of ["rebase-merge", "rebase-apply"]) {
      const state = join(repo, ".git", dir)
      mkdirSync(state, { recursive: true })
      const during = drive()
      ok(
        during.status === 0 && /rebase in progress/.test(String(during.stdout ?? "")),
        `prepare-commit-msg: skips while .git/${dir} exists — a rebase replay is not gated per intermediate commit`,
      )
      rmSync(state, { recursive: true, force: true })
    }

    // …and the skip is not sticky: with the state directory gone the gate is live again.
    ok(drive().status !== 0, "prepare-commit-msg: the gate is live again once the rebase ends")
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

console.log(
  failed
    ? `\n❌ ${failed} probe(s) wrong`
    : "\n✅ probes green — hooks exist, are wired, block on failure, and their seam is inert without the probe flag",
)
process.exit(failed ? 1 : 0)
