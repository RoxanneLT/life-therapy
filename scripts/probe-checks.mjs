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
 * layers that actually broke (dev-standards/ledgers/LESSONS.md L-06, L-33).
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
  {
    // The absent-from-the-suite direction. This plant is a TEST FILE, which most checks skip
    // by design (`isTest`) — that is the point: the file is invisible to the rest of the audit
    // and to `npm test` alike, which is exactly the condition the check exists to name. Its
    // body is a real passing test, because a test file that cannot run would be caught by the
    // runner and this class is about one that runs fine and is simply never invoked.
    path: "lib/__probe-floor.test.ts",
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
import { test } from "node:test";
import assert from "node:assert/strict";

test("a test nobody runs still passes", () => {
  assert.equal(1, 1);
});
`,
    expects: ["test-floor: every test file on disk is in the suite the gate runs"],
  },
  {
    // The citations check went unprobed from 2026-08-19 to 2026-09-10, and in that time both
    // of its detectors went blind or wrong without anything going red (see the check). This
    // plants the shape added last: the ledger named at the path it had before it moved.
    //
    // The path is built by interpolation so THIS file does not commit the violation it plants
    // — the check reads scripts/, and a literal here would fail the audit on the probe's own
    // source, which is the check-matching-its-documentation trap its comment already records.
    //
    // One plant per tree the check reads beyond source, because the scope was widened to those
    // trees the same day and a `must fire` on the check NAME cannot see a walk being deleted —
    // the other plants still trip it (L-54: the mutant for a widening is "narrow it again").
    // So these carry `named: true`, which requires the audit to print THIS path under a ✗.
    // That is what makes four plants for one check four probes rather than one.
    path: "lib/__probe-citation.ts",
    named: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
// A lesson cited at the ledger's old path (${"dev-standards"}/LESSONS.md L-21).
export {};
`,
    expects: ["citations: a lesson reference names the ledger that holds it"],
  },
  // The check's other two shapes, and the known-good case its narrowing exists for. Built by
  // interpolation for the same reason as above. The `quiet` plant is an HONEST three-digit
  // citation: the zero-padding detector used to match `\d{3,}`, and the mutant "widen it back"
  // survives every plant that only asks the check to fire.
  {
    path: "lib/__probe-cite-pointer.ts",
    named: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.\n// Cites the local pointer with an ID (${"docs"}/LESSONS.md L-21).\nexport {};\n`,
    expects: ["citations: a lesson reference names the ledger that holds it"],
  },
  {
    path: "lib/__probe-cite-padded.ts",
    named: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.\n// Cites the retired local numbering (dev-standards/ledgers/LESSONS.md L-${"007"}).\nexport {};\n`,
    expects: ["citations: a lesson reference names the ledger that holds it"],
  },
  {
    path: "lib/__probe-cite-honest.ts",
    quiet: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.\n// An honest citation past L-99 (dev-standards/ledgers/LESSONS.md L-100).\nexport {};\n`,
    expects: [],
  },
  ...["docs", ".claude", "brief"].map((tree) => ({
    path: `${tree}/__probe-citation.md`,
    named: true,
    content: `Planted by scripts/probe-checks.mjs. Deleted before this script exits.
A lesson cited at the ledger's old path (${"dev-standards"}/LESSONS.md L-21).
`,
    expects: ["citations: a lesson reference names the ledger that holds it"],
  })),
  // THROTTLES (L-52). The guard was `/rate-?limit/i`, and each plant below is a shape it got
  // wrong. Measured one at a time against both versions on 2026-09-10: the three `named` plants
  // left the old audit at exit 0, and the old audit reported the `quiet` one, a real throttle
  // under an alias, as unguarded. Two plants share `server-action-auth`, so the runner's
  // `failed.has(name)` cannot tell them apart; `named` does, because each must be named by path.
  // In isolation, each is named by its target check and by nothing else.
  {
    path: "app/(public)/__probe-throttle/actions.ts",
    named: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
// A public write whose only rate-limit call is the one that LIFTS a limit.
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { clearRateLimitDb, limitKey } from "@/lib/rate-limit-db";

export async function probeThrottleAction(email: string) {
  await clearRateLimitDb(limitKey("probe", "email", email));
  await prisma.newsletterSubscriber.create({ data: { email } });
  revalidatePath("/");
  return { success: true };
}
`,
    expects: ["server-action-auth: every mutating action is guarded for its route group"],
  },
  {
    path: "app/(public)/__probe-throttle-alias/actions.ts",
    quiet: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
// A real throttle under a local alias: the check must follow the import, not the spelling.
"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { rateLimitNewsletterDb as overLimit } from "@/lib/rate-limit-db";

export async function probeAliasAction(ip: string, email: string) {
  if (await overLimit(ip)) return { success: false, error: "Too many attempts." };
  await prisma.newsletterSubscriber.create({ data: { email } });
  revalidatePath("/");
  return { success: true };
}
`,
    expects: [],
  },
  {
    path: "app/api/__probe-guard/route.ts",
    named: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
// Guarded upstream by requireRole(), says this comment. Nothing below calls anything.
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { id } = await req.json();
  await prisma.newsletterSubscriber.update({ where: { id }, data: { active: false } });
  return Response.json({ ok: true });
}
`,
    expects: ["server-action-auth: mutating API routes and inline actions are guarded"],
  },
  {
    path: "app/__probe-mfa/verify.ts",
    named: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
// Imports the durable limiter's module, and calls only the function that lifts a limit.
import { createClient } from "@/lib/supabase/server";
import { clearRateLimitDb } from "@/lib/rate-limit-db";

export async function probeVerify(factorId: string, code: string) {
  const supabase = await createClient();
  await clearRateLimitDb(factorId);
  return supabase.auth.mfa.challengeAndVerify({ factorId, code });
}
`,
    expects: ["abuse: an MFA/OTP verify is rate-limited"],
  },
  {
    // A real throttle, but the per-instance in-memory one, which resets on a cold start. Without
    // this plant, dropping the check's `durable` filter survived every probe (L-54).
    path: "app/__probe-mfa/verify-in-memory.ts",
    named: true,
    content: `// Planted by scripts/probe-checks.mjs. Deleted before this script exits.
// Throttled, but only per warm instance: the limit resets with the lambda.
import { createClient } from "@/lib/supabase/server";
import { rateLimitApi } from "@/lib/rate-limit";

export async function probeVerifyInMemory(ip: string, factorId: string, code: string) {
  if (!rateLimitApi(ip).success) return null;
  const supabase = await createClient();
  return supabase.auth.mfa.challengeAndVerify({ factorId, code });
}
`,
    expects: ["abuse: an MFA/OTP verify is rate-limited"],
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
  {
    // The OTHER direction of the test floor: a path the suite names that is not on disk. It
    // needs its own probe because it is a different branch, and because its real-world failure
    // is misread — `tsx --test` dies on a path error that looks like a broken toolchain, so
    // the instinct is to delete the entry rather than ask where the test went.
    //
    // ⚠ THIS IS THE FIRST ENTRY TO SHARE AN `expects` NAME WITH ANOTHER, AND THE RUNNER CANNOT
    // TELL THEM APART. Every plant is applied before ONE audit run, and the assertion is
    // `failed.has(name)` — so two entries naming the same check both read green when only one
    // of them actually trips it, and a dead plant is indistinguishable from a live one. Both
    // were verified in isolation when they were added (each alone fires the check; each alone
    // goes quiet when removed). If a third direction is added here, isolate it the same way —
    // the suite will not do it for you.
    path: "package.json",
    find: '"test": "tsx --test ',
    replace: '"test": "tsx --test lib/__probe-vanished.test.ts ',
    expects: ["test-floor: every test file on disk is in the suite the gate runs"],
  },
  {
    // The scar's own regression, in the scar's own file: the birthday query filtering the pause
    // in SQL, which is how the practice owner's birthday email stopped arriving. The email-tiers
    // check was green over exactly this until 2026-09-10 — it watched branches, and this is a
    // query (L-48). `named`, so the finding must be THIS file, not some other sender.
    path: "lib/birthday-process.ts",
    named: true,
    find: "dateOfBirth: { not: null },\n",
    replace: "dateOfBirth: { not: null },\n      emailPaused: false,\n",
    expects: ["email-tiers: a suppression decision goes through lib/engagement.ts"],
  },
  {
    // A throttle THROTTLES trusts, renamed out from under it. The list would otherwise go on
    // vouching for any file calling the old name, which then resolves to nothing.
    path: "lib/rate-limit-db.ts",
    named: true,
    find: "export async function checkAndRecord(",
    replace: "export async function checkAndRecordRenamed(",
    expects: ["allowlists: every exemption is still load-bearing"],
  },
];

/**
 * The needles above are written with LF. The WORKING TREE's line endings are not this repo's
 * to choose — `core.autocrlf` decides them at checkout, and Git for Windows defaults it to
 * true, so a clone rewrites every text file to CRLF. An LF needle then matches nothing, and
 * the two CLAUDE.md probes report PLANT FAILED against a tree with nothing wrong with it.
 *
 * Not hypothetical and not cosmetic: `npm run check` is the LAST step of SETUP-NEW-PC.ps1, so
 * the documented bootstrap for a new machine ended in a red gate pointing at the wrong thing.
 * Found on 2026-08-20 when a routine `git checkout` converted this tree and two probes that had
 * always passed went red without a line of their subject matter changing.
 *
 * The harness behaved correctly — it refused to report a pass it could not back, which is the
 * whole point of the PLANT FAILED path. The defect was the needle's undeclared dependency on a
 * checkout setting.
 *
 * Fixed HERE rather than by pinning line endings repo-wide with .gitattributes. That would work
 * too, and it is arguably the better fix, but it is a decision about every file in the repo and
 * every machine that clones it — whereas a probe that only functions under one checkout
 * configuration is just a bug in the probe. The two are not alternatives; this is the half that
 * is unambiguously mine to fix.
 */
const eolOf = (s) => (/\r\n/.test(s) ? "\r\n" : "\n");

/** A literal needle, tolerant of either line ending. Regex metacharacters are escaped first. */
const needle = (find) =>
  new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\n/g, "\r?\n"));

/**
 * Run the audit and return the set of check names that reported a failure, AND the exit status.
 *
 * The status was discarded until 2026-09-10, and that was a hole in the gate (L-51). The gate is
 * an `&&` chain: it reads the audit's exit code and nothing else, while this suite read the ✗
 * lines and nothing else. Demonstrated by mutation, not by reading — the audit's final
 * `process.exit(1)` edited to `exit(0)` left all 15 `must fire` probes green and this script
 * exiting 0. The audit would have printed every violation and let the commit through.
 */
function failedChecks() {
  let out;
  let status = 0;
  try {
    out = execFileSync("node", [AUDIT], { cwd: ROOT, encoding: "utf8" });
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`; // non-zero exit is the normal case here
    status = e.status ?? 1; // null means killed by a signal — still not a clean exit
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
  return { failed, out, status };
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
    const re = needle(m.find);
    if (!re.test(original)) {
      console.log(`  ✗ PLANT FAILED — "${m.find.slice(0, 40)}" not found in ${m.path}`);
      console.log(`      the probe proves nothing; fix the needle before trusting this run.`);
      wrong++;
      continue;
    }
    const planted = m.replace.replace(/\n/g, eolOf(original));
    writeFileSync(abs, original.replace(re, () => planted));
  }

  const { failed, status, out } = failedChecks();
  const exitedRed = status !== 0;
  if (!exitedRed) wrong++;
  console.log(`  ${exitedRed ? "✓" : "✗"} must exit non-zero — the audit, with violations planted (exit ${status})`);
  if (!exitedRed) {
    console.log(`      the audit printed its findings and exited 0. The gate reads the exit code,`);
    console.log(`      not the report, so every violation below would have been committed.`);
  }
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
    if (f.named) {
      const namedIt = out.includes(`✗ ${f.path}`);
      if (!namedIt) wrong++;
      console.log(`  ${namedIt ? "✓" : "✗"} must name  — ${f.path}, by path, under a ✗`);
    }
    if (f.quiet) {
      const spared = !out.includes(`✗ ${f.path}`);
      if (!spared) wrong++;
      console.log(`  ${spared ? "✓" : "✗"} must spare — ${f.path}, a known-good plant, named by no check`);
    }
  }
} finally {
  for (const abs of created) rmSync(abs, { force: true });
  for (const dir of createdDirs.reverse()) rmSync(dir, { force: true, recursive: true });
  for (const [abs, original] of mutated) writeFileSync(abs, original);
}

// The known-good half, and the restore check in one: with the plants gone the tree must
// be clean again. A probe suite that leaves its fixtures behind is worse than none.
const { failed: afterFailed, status: afterStatus } = failedChecks();
const exitedClean = afterStatus === 0;
if (!exitedClean) wrong++;
console.log(`  ${exitedClean ? "✓" : "✗"} must exit 0     — the audit, plants removed (exit ${afterStatus})`);
const expectedNames = [...PLANTED_FILES, ...MUTATIONS].flatMap((f) => f.expects);
for (const name of expectedNames) {
  const quiet = !afterFailed.has(name);
  if (!quiet) wrong++;
  console.log(`  ${quiet ? "✓" : "✗"} must pass  — ${name} (plants removed)`);
}

console.log(wrong ? `\n❌ ${wrong} probe(s) wrong` : `\n✅ probes green — every literal-hunting check fires on a planted literal`);
process.exit(wrong ? 1 : 0);
