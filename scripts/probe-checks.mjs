/**
 * Behavioural probes for the checks whose target lives inside a string literal.
 *
 * The gap this closes: `--selftest` proves the HELPERS behave (13 fixtures), and
 * `audit: a check that says it scans raw actually scans raw` proves the preprocessing
 * CLAIM matches the code. Neither proves a check actually fires. A check can read raw
 * source, keep every literal, and still match nothing — which is the original `+02:00`
 * failure, green for months.
 *
 * So: plant a violation where the check will see it, run the real audit, and require
 * that check to fail. Probes travel the full pipeline — file on disk, real discovery,
 * real preprocessing — because a fixture handed straight to a matcher skips the three
 * layers that actually broke (dev-standards/LESSONS.md L-06, L-33).
 *
 * The known-good half is the audit's own green run, asserted at the end: plant nothing,
 * everything passes. Without it a matcher that flags everything would look perfect here.
 *
 * Run: npm run test:probes (part of `npm run check`)
 */
import { writeFileSync, rmSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT = join(ROOT, "scripts/architecture-audit.mjs");

/**
 * Each entry is one temporary file and the checks it must trip. Grouped by file so the
 * whole set costs ONE audit run: the audit takes ~3s and 13 runs is a minute nobody
 * spends, which is how probe suites stop being run.
 */
const PLANTED_FILES = [
  {
    path: "lib/__probe-literals.ts",
    // Every line here is a violation whose marker is a STRING LITERAL — the exact class
    // `code()` used to blank into invisibility.
    // The CSV plant is named \`rowFor\`, not \`csvRow\`: the check skips any line mentioning
    // the sanctioned helper, so a plant named after the thing it bypasses is skipped as a
    // legitimate call and proves nothing. First draft did exactly that and reported the
    // check blind. Plant what the field does, not what reads well (L-30).
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
// CSV export fixture.
export const TZ_OFFSET = "+02:00";
export const shownAt = (d: Date) => d.toLocaleDateString("en-ZA");
export const rowFor = (cells: string[]) => cells.join(",");
export const INVITE_KEY = "couples_partner_invite";
export const tracked = (e: string) => \`https://life-therapy.co.za/api/track/click?t=x&url=\${e}\`;
`,
    expects: [
      "date-safety: no hardcoded +02:00 offset",
      "date-safety: display formatting resolves in SAST",
      "csv: every export goes through the one escaper",
      "email-safety: the couples partner invite goes through its one helper",
      "email-tracking: a tracked link is one the redirector will forward",
    ],
  },
  {
    path: "lib/__probe-queries.ts",
    // Violations whose marker is a literal inside a Prisma call — `status: "paid"`,
    // `status: "cancelled"`, a marketing template key. Separate file so a syntax-shaped
    // plant cannot interfere with the plain-literal set above.
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
import { prisma } from "@/lib/prisma";

export async function markPaid(id: string) {
  // Marks an invoice paid and never stamps when.
  await prisma.invoice.update({ where: { id }, data: { status: "paid" } });
}

export async function blastThem() {
  const templateKey = "drip_welcome";
  const people = await prisma.student.findMany({ where: { emailOptOut: false } });
  return { templateKey, people };
}
`,
    expects: [
      "money: marking an invoice paid must stamp paidAt",
      "email-safety: a marketing sender checks consent",
    ],
  },
  {
    // Scope is part of the plant. This check reads ONLY `app/**/actions.ts`, so the same
    // code in lib/ proves nothing — the first draft put it there and reported the check
    // blind. Where a check looks is as much a part of its behaviour as what it matches.
    // Inside the (admin) route group deliberately: the auth check resolves a REGIME from
    // the group in the path and skips any file it cannot place. A plant outside every
    // group is unguarded code the check is designed to ignore, so it proved nothing —
    // twice, before this path was right.
    path: "app/(admin)/admin/(dashboard)/__probe/actions.ts",
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
"use server";
import { prisma } from "@/lib/prisma";

export async function cancelBookingProbeAction(id: string) {
  // Cancels a booking and never touches the calendar — the 2026-08-18 scar exactly.
  // Also mutates with no requireRole, which is the auth check's business.
  await prisma.booking.update({ where: { id }, data: { status: "cancelled" } });
}
`,
    expects: [
      "calendar: a cancel path removes the calendar event",
      // The `"use server"` directive is load-bearing for this one: without it the file is
      // not a server-action file and the auth check skips it entirely. The first draft
      // omitted it and the check stayed silent on an unguarded mutation.
      "server-action-auth: every mutating action is guarded for its route group",
    ],
  },
];

/**
 * Some checks read files that already exist — CLAUDE.md, the hooks — so their probe has
 * to EDIT rather than add. Every mutation is backed up first and restored in the same
 * `finally` as the planted files, and the run ends by asserting the tree is clean again.
 * A probe that can corrupt the doctrine file is only acceptable if it cannot leave it
 * corrupted.
 */
const MUTATIONS = [
  {
    path: "CLAUDE.md",
    // A rule bullet with no marker: the section claims enforcement it does not name.
    find: "### Enforced\n",
    replace: "### Enforced\n\n- **Planted rule with no net.** Deleted before this script exits.\n",
    expects: ["claude-md: every rule in a rules section carries its net"],
  },
  {
    path: "CLAUDE.md",
    // A visibly unenforceable rule with no queue entry — debt with nowhere to be built.
    find: "## 5 · DOCTRINE THE MACHINE CANNOT HOLD\n",
    replace:
      "## 5 · DOCTRINE THE MACHINE CANNOT HOLD\n\n- **Planted unenforceable rule.** UNENFORCEABLE — and pointing at no queue entry.\n",
    expects: ["mechanisable: every unenforceable rule has a queue entry, and vice versa"],
  },
  {
    path: ".claude/hooks/bash-gate.js",
    // Strip a probe record: a twin nobody has ever tested is a dormant fallback whose rot
    // cannot announce itself, which is the whole reason the record is required.
    find: "// @probed",
    replace: "// probed-not",
    expects: ["hooks: every hook declares its twin or why it cannot have one"],
  },
];

/** Run the audit and return the set of check names that reported a failure. */
function failedChecks() {
  let out;
  try {
    out = execFileSync("node", [AUDIT], { cwd: ROOT, encoding: "utf8" });
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`; // non-zero exit is the normal case here
  }
  // A check that prints a note ("↳ 6 unenforceable of 24 rules") pushes its ✓/✗ onto the
  // FOLLOWING line. The first version of this parser only looked at the line carrying the
  // name, so every noted check read as "did not fire" — two probes reported blind checks
  // that were working perfectly. The harness had the same defect it exists to detect:
  // an instrument that cannot see the signal reports its absence (L-01).
  const lines = out.split("\n");
  const failed = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = /^ {2}• (.+?)\.\.\./.exec(lines[i]);
    if (!m) continue;
    const tail = lines[i].slice(m[0].length);
    const verdict = /[✓✗]/.test(tail) ? tail : (lines[i + 1] ?? "");
    if (verdict.includes("✗")) failed.add(m[1]);
  }
  return { failed, out };
}

const created = [];
const mutated = new Map();
const createdDirs = [];
let wrong = 0;

try {
  for (const f of PLANTED_FILES) {
    const abs = join(ROOT, f.path);
    if (existsSync(abs)) throw new Error(`${f.path} already exists — refusing to overwrite`);
    const dir = dirname(abs);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      createdDirs.push(dir);
    }
    writeFileSync(abs, f.content);
    created.push(abs);
  }

  for (const m of MUTATIONS) {
    const abs = join(ROOT, m.path);
    const original = readFileSync(abs, "utf8");
    if (!mutated.has(abs)) mutated.set(abs, original);
    if (!original.includes(m.find)) {
      console.log(`  ✗ PLANT FAILED — "${m.find.slice(0, 40)}" not found in ${m.path}`);
      console.log(`      the probe proves nothing; fix the needle before trusting this run.`);
      wrong++;
      continue;
    }
    writeFileSync(abs, original.replace(m.find, m.replace));
  }

  const { failed } = failedChecks();
  if (process.argv.includes("--verbose")) {
    const asserted = new Set(PLANTED_FILES.flatMap((f) => f.expects));
    const extra = [...failed].filter((n) => !asserted.has(n));
    if (extra.length) console.log(`  (also tripped, not asserted: ${extra.join(" · ")})\n`);
  }
  for (const f of [...PLANTED_FILES, ...MUTATIONS]) {
    for (const name of f.expects) {
      const fired = failed.has(name);
      if (!fired) wrong++;
      console.log(`  ${fired ? "✓" : "✗"} must fire  — ${name}`);
      if (!fired) {
        console.log(`      the plant in ${f.path} did not trip it: either the plant is in the`);
        console.log(`      wrong shape or scope, or the check cannot fire at all. Both matter.`);
      }
    }
  }
} finally {
  for (const abs of created) rmSync(abs, { force: true });
  for (const dir of createdDirs.reverse()) rmSync(dir, { force: true, recursive: true });
  for (const [abs, original] of mutated) writeFileSync(abs, original);
}

// The known-good half, and the restore check in one: with the plants gone the tree must
// be clean again. A probe suite that leaves its fixtures behind is worse than none.
const { failed: afterFailed } = failedChecks();
const expectedNames = [...PLANTED_FILES, ...MUTATIONS].flatMap((f) => f.expects);
for (const name of expectedNames) {
  const quiet = !afterFailed.has(name);
  if (!quiet) wrong++;
  console.log(`  ${quiet ? "✓" : "✗"} must pass  — ${name} (plants removed)`);
}

console.log(wrong ? `\n❌ ${wrong} probe(s) wrong` : `\n✅ probes green — every literal-hunting check fires on a planted literal`);
process.exit(wrong ? 1 : 0);
