#!/usr/bin/env node
/**
 * Architecture audit — catches the structural bug classes that typecheck, ESLint
 * and file-level review all miss. Each check is named after the bug class it
 * catches, and every one of them exists because we SHIPPED that bug.
 *
 * When a new class of bug gets through, add a check here. That is the whole point:
 * the suite grows a scar for every wound.
 *
 * Runs as part of `npm run check`. Pure file inspection — no network, no DB, no
 * app server. Offline-safe. Exit 0 on pass, 1 on fail.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const findings = [];
let checksRun = 0;

const fail = (check, file, msg, fix) => findings.push({ check, file, msg, fix });

function check(name, fn) {
  checksRun++;
  const before = findings.length;
  process.stdout.write(`  • ${name}... `);
  try {
    fn();
    const n = findings.length - before;
    console.log(n === 0 ? "✓" : `✗ (${n})`);
  } catch (e) {
    console.log(`✗ crashed: ${e.message}`);
    fail(name, "(audit)", `crashed: ${e.message}`, "investigate the audit script itself");
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "generated", "dist", ".vercel"]);

function walk(dir, ext = /\.(tsx?|mjs)$/) {
  const out = [];
  (function recurse(d) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      if (SKIP_DIRS.has(entry) || entry.startsWith(".")) continue;
      const p = join(d, entry);
      if (statSync(p).isDirectory()) recurse(p);
      else if (ext.test(entry)) out.push(p);
    }
  })(dir);
  return out;
}

const read = (p) => readFileSync(p, "utf-8");
const rel = (p) => p.replace(ROOT, "").replaceAll("\\", "/").replace(/^\//, "");

/**
 * ⚠ THIS BLANKS STRING LITERALS. Read `read()` instead when hunting one.
 *
 * The name says `code`, which reads as "the source" and means "the source minus its
 * string literals and comments". FIVE checks in a single session were written against
 * it while hunting a literal — `+02:00`, `status: "cancelled"`, a template key, a
 * `@twin` pattern, `.join(",")` — and every one of them silently could not fire. Each
 * was caught only by planting a violation and watching nothing happen.
 *
 * The rule, stated once: if the thing you are looking for lives inside quotes, this
 * function has already deleted it.
 *
 * Strip comments and string/template literals so we match code, not prose.
 *
 * Line structure is PRESERVED: a block comment collapses to its own newlines
 * rather than vanishing. Without this, every line number after the first /* … *\/
 * is shifted, and the audit reports findings at the wrong place — which is worse
 * than not reporting them, because it sends the reader somewhere innocent.
 */
function code(src) {
  const keepLines = (m) => "\n".repeat((m.match(/\n/g) || []).length);
  return src
    .replace(/\/\*[\s\S]*?\*\//g, keepLines)
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/`(?:\\.|[^`\\])*`/g, keepLines)
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

/**
 * Comments gone, STRING LITERALS KEPT. The other half of `code()`.
 *
 * Most checks want one of two things and there was only ever one helper. `code()` removes
 * comments AND literals, which is right when prose must not read as a violation and wrong
 * whenever the thing being hunted lives in quotes — five checks were written against it
 * while hunting a literal and silently could not fire.
 *
 * A sixth found the opposite failure: `code()`'s literal-blanking is regex-based, so an
 * apostrophe or quote it pairs wrongly swallows everything to the next match. On one file
 * it deleted the entire tail, and a check scanning it reported clean on a planted
 * violation. That is not a bug worth chasing in a heuristic stripper — it is a reason to
 * stop asking it for something it was never for.
 *
 * Use this when the target is a literal or a member access and prose must still be
 * excluded; use `code()` only when literals genuinely must not match.
 */
function codeKeepingLiterals(src) {
  const keepLines = (m) => "\n".repeat((m.match(/\n/g) || []).length);
  return src.replace(/\/\*[\s\S]*?\*\//g, keepLines).replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/** A check name normalised to a control id. Shared, so the two call sites cannot drift. */
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * `--selftest` — a regression suite for the helpers every check is built on.
 *
 * These fixtures are not hypothetical: each one is a false positive or an unfailable
 * check that actually shipped here. They lived only as prose in the comment above the
 * check that had been burned, which meant the LESSON was recorded and the REGRESSION
 * was not. A probe you have to remember to run is a probe that rots.
 *
 * Runs before any check(), so it exercises the helpers without walking the tree, and
 * exits — `npm run audit:selftest`, wired into `npm run check`.
 */
if (process.argv.includes("--selftest")) {
  let failed = 0;
  const t = (label, got, want) => {
    const ok = got === want;
    if (!ok) failed++;
    console.log(`  ${ok ? "✓" : "✗"} ${label}${ok ? "" : `\n      got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  };

  // code() blanks STRING LITERALS. The `+02:00` check scanned code() for an offset
  // that only ever appears inside a string — so it could never fire, and shipped
  // green for months. Any check hunting a literal must read RAW source.
  t("code() blanks string literals", /\+02:00/.test(code(`const tz = "+02:00";`)), false);
  t("...so the raw source still has it", /\+02:00/.test(`const tz = "+02:00";`), true);

  // code() strips comments, which is what stops prose ABOUT a marker matching AS one.
  t("code() strips a line comment", /@twin/.test(code(`// the @twin design below`)), false);
  t("code() keeps real code", /cancelCalendarEvent/.test(code(`await cancelCalendarEvent(id);`)), true);

  // Line structure survives, or every finding after a block comment points somewhere innocent.
  t("code() preserves line count", code(`/*\n\n*/\nconst a = 1;`).split("\n").length, 4);

  // Near-miss by normalisation: a tag written from memory that slugifies CLOSE to a
  // real check but not to it. This one shipped, and was caught by hand.
  t("slug() normalises a real check name",
    slug("date-safety: no hardcoded +02:00 offset"), "date-safety-no-hardcoded-02-00-offset");
  t("...and the from-memory version does NOT match",
    slug("date-safety: no hardcoded +02:00 offset") === "date-safety-no-hardcoded-offset", false);

  // A marker is a comment whose ENTIRE body is markers. Scoping to comment syntax
  // alone flagged this file's own documentation, twice.
  const isMarker = (body) => /^\s*(?:@enforced\s+\S+\s*)+$/.test(body);
  t("a marker-only comment is a marker", isMarker(" @enforced audit:foo "), true);
  t("two markers in one comment", isMarker(" @enforced audit:foo @enforced hook:bar "), true);
  t("prose ABOUT the marker is not a marker", isMarker(" @enforced <ns:control-id> → an HTML comment"), false);

  // The SIXTH code() incident, and the one that is not "it blanked my literal". Its
  // literal-stripping is regex-based, so a quote it pairs wrongly swallows everything to
  // the next match — on one real file it deleted the whole tail, and a check scanning it
  // reported CLEAN on a planted violation. codeKeepingLiterals() is the safe reach when
  // the target is a literal or a member access.
  const swallowed = `const re = /^[=+@]/;\nconst s = "a";\nd.toLocaleDateString("en-ZA");`;
  t("codeKeepingLiterals keeps a member access", /toLocaleDateString/.test(codeKeepingLiterals(swallowed)), true);
  t("codeKeepingLiterals still strips comments", /secret/.test(codeKeepingLiterals("// secret\nconst a = 1;")), false);
  t("...and keeps the literal a check might hunt", /"en-ZA"/.test(codeKeepingLiterals(swallowed)), true);

  console.log(failed ? `\n❌ audit selftest: ${failed} wrong` : `\n✅ audit selftest — the helpers still behave as every check assumes`);
  process.exit(failed ? 1 : 0);
}

const APP = join(ROOT, "app");
const LIB = join(ROOT, "lib");
const COMPONENTS = join(ROOT, "components");
/**
 * Test files are exempt from the source rules they exist to defend. billing.test.ts
 * deliberately contains `vatApplies("USD", true)` and bare formatPrice() calls as
 * FIXTURES — flagging them would mean the only way to pass the audit is to stop
 * testing the rule. (dates.test.ts hardcodes "+02:00" for exactly the same reason.)
 */
const isTest = (p) => /\.test\.tsx?$/.test(p);
const allSource = () =>
  [...walk(APP), ...walk(LIB), ...walk(COMPONENTS)].filter((f) => !isTest(f));

// ═══════════════════════════════════════════════════════════════════════════
// 1. DATE SAFETY
//
// The bug: dates resolved outside lib/dates.ts. The SAST day turns over at
// 22:00 UTC, so `.toISOString().slice(0,10)` on a real instant (paidAt,
// createdAt) yields the WRONG DAY for two hours every night — which is how an
// invoice paid at 00:30 SAST on 1 March exported inside the previous financial
// year, and how invoice numbers got stamped with the previous day.
//
// `new Date(y, m, d)` is local midnight: UTC on Vercel, SAST on a dev machine.
// `format()` from date-fns renders in the SERVER's timezone.
// ═══════════════════════════════════════════════════════════════════════════

// Files allowed to touch raw date primitives — the SSOT itself, and the two
// Graph call sites that legitimately slice a datetime string because the request
// sends a `Prefer: outlook.timezone` header (Graph then returns SAST-local
// strings). Those are correct; a codemod over them would have broken production.
const DATE_ALLOWLIST = new Set([
  "lib/dates.ts",
  "lib/dates.test.ts",
  "lib/graph.ts", // Prefer: outlook.timezone header — returns SAST strings
  "lib/calendar-reconcile.ts", // same
  // NOTE: lib/sa-public-holidays.ts used to sit here. It was a SECOND holiday list
  // answering the same question in string form, without the s2A proclamations — so
  // a proclaimed holiday was refused by the reschedule guard and accepted by series
  // generation. Deleted; `isSAPublicHolidayOn` on lib/sa-holidays.ts replaced it,
  // and that file needs no exemption — its Date.UTC(...) construction is correct.
  // NOTE: lib/sa-holidays.ts and lib/billing.ts used to sit here, excused as
  // "self-consistent local-getter arithmetic". They were consistent with each
  // other and wrong with everything else — the dueDate/overdue off-by-one came
  // straight out of that exemption. Both now do their day arithmetic in UTC, so
  // neither needs excusing. An allowlist entry is a place bugs hide; this one did.
]);

/**
 * Find `new Date(...)` calls and return their TOP-LEVEL argument list.
 * Balanced-paren scan, because a regex cannot tell `new Date(Date.UTC(y, m, 1))`
 * (ONE argument — and correct) from `new Date(y, m, 1)` (THREE — and local
 * midnight). Getting this wrong floods the report and trains people to ignore it.
 */
function newDateCalls(src) {
  const out = [];
  const re = /new Date\(/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    const inner = src.slice(start, i - 1);
    // Split on commas at depth 0 only.
    const args = [];
    let d = 0;
    let cur = "";
    for (const ch of inner) {
      if (ch === "(" || ch === "[" || ch === "{") d++;
      if (ch === ")" || ch === "]" || ch === "}") d--;
      if (ch === "," && d === 0) {
        args.push(cur.trim());
        cur = "";
      } else cur += ch;
    }
    if (cur.trim()) args.push(cur.trim());
    out.push({ args, text: `new Date(${inner.slice(0, 40)})` });
  }
  return out;
}

check("date-safety: no local-midnight Date constructors", () => {
  for (const f of allSource()) {
    if (DATE_ALLOWLIST.has(rel(f))) continue;
    const src = code(read(f));
    // 3+ top-level args = new Date(year, month, day) = LOCAL midnight, which is
    // UTC on Vercel and SAST on a dev box. new Date(Date.UTC(...)) is one arg,
    // and is the correct way to build a calendar date — never flag it.
    const bad = newDateCalls(src).filter((c) => c.args.length >= 3);
    if (bad.length) {
      fail(
        "date-safety",
        rel(f),
        `${bad.length} local-midnight Date constructor(s): ${bad[0].text}`,
        "use calendarDate(dateStr) or saMonthStart(year, month) from lib/dates.ts",
      );
    }
  }
});

check("date-safety: no ISO-slicing a real instant", () => {
  for (const f of allSource()) {
    if (DATE_ALLOWLIST.has(rel(f))) continue;
    const src = code(read(f));
    // .toISOString().slice(0,10) / .split("T")[0] on new Date() or a *At field.
    const patterns = [
      /new Date\(\)\s*\.toISOString\(\)\s*\.(slice|substring)\(\s*0\s*,\s*10\s*\)/g,
      /new Date\(\)\s*\.toISOString\(\)\s*\.split\(\s*""\s*\)/g,
      /\b\w*(?:createdAt|paidAt|updatedAt|sentAt|activatedAt)\w*\s*\.toISOString\(\)\s*\.(slice|substring|split)\(/g,
    ];
    for (const re of patterns) {
      const m = src.match(re);
      if (m) {
        fail(
          "date-safety",
          rel(f),
          `${m.length} ISO-slice(s) on a real instant — yields the UTC day, not the SAST day`,
          "use saToday() or saDateStr(instant) from lib/dates.ts",
        );
      }
    }
  }
});

check("date-safety: saDayStart/saDayEnd are query bounds, never stored values", () => {
  // A stored DAY (booking.date, dueDate, periodStart, dateOfBirth) is UTC midnight
  // — `calendarDate()`. `saDayStart()` is 22:00 UTC the day BEFORE, which is the
  // right bound for a range over a real timestamp but the WRONG value to persist:
  // a UTC server reads it back with local getters as the previous date.
  //
  // That is not hypothetical. Bill-to-Date stored dueDate via saDayStart, and the
  // reminder/overdue arithmetic in lib/billing.ts (local getters) then read it as
  // the day before — so a client told "due the 19th" was marked overdue ON the
  // 19th. The two halves were each defensible; together they were wrong.
  const DAY_FIELDS = /(?:date|dueDate|periodStart|periodEnd|originalDate|dateOfBirth)\s*[:,]/;
  for (const f of allSource()) {
    const src = code(read(f));
    if (!/saDay(?:Start|End)\s*\(/.test(src)) continue;
    // Look for `<dayField>: <ident>` where <ident> was assigned from saDayStart.
    const assigned = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*saDay(?:Start|End)\s*\(/g)].map((m) => m[1]);
    for (const name of assigned) {
      const written = new RegExp(`(?:${DAY_FIELDS.source.replace(/\\s\*\[:,\]/, "")})\\s*:\\s*${name}\\b`);
      if (written.test(src)) {
        fail(
          "date-safety",
          `${rel(f)} → ${name}`,
          `a saDayStart/saDayEnd value is written to a day-valued column — it persists as 22:00 UTC the PREVIOUS day`,
          "store days with calendarDate(); keep saDayStart for gte/lt bounds over a timestamp column",
        );
      }
    }
  }
});

/**
 * A `@db.Date` column holds a DAY, stored at UTC midnight. `new Date()` is a
 * MOMENT. Comparing the two in a Prisma `where` is not a rounding error — it
 * silently redefines "today" as "already past", because today's row (00:00 UTC)
 * sorts before any instant later than 02:00 SAST.
 *
 * Every symptom of this looked like a different bug. "Mark All Completed"
 * completed sessions that had not happened yet and fed them into billing. The
 * client portal told a client with a 15:00 session that they had none upcoming.
 * The dashboard's Next Session card skipped to tomorrow before breakfast, so the
 * two-hour "starting soon" highlight could never fire once. Six sites, one
 * mistake, and not one of them was reachable by the existing date checks —
 * they all scan for hand-rolled *construction*, and these were hand-rolled
 * *comparison*.
 *
 * The day columns are exactly: bookings.date, bookings.originalDate,
 * availability_overrides.date, students.dateOfBirth. dueDate/periodStart/
 * periodEnd are real timestamps and belong nowhere near this check.
 */
const DAY_COLUMNS = "date|originalDate|dateOfBirth";

// A day column bounded by an instant ON PURPOSE, with the reason. Not a silencer:
// if the reason stops being true, the entry is the thing that has to change.
const DAY_VS_INSTANT_OK = new Map([
  [
    "lib/calendar-reconcile.ts",
    "the window is an instant on BOTH sides — the same `now` is handed to Graph's " +
      "calendarView, so widening only the DB half would report this morning's " +
      "finished sessions as missing from the calendar",
  ],
]);

check("date-safety: a day column is never bounded by a live instant", () => {
  for (const f of allSource()) {
    const relf = rel(f);
    const src = code(read(f));

    // Identifiers holding a live instant: `const now = new Date()`.
    const instants = new Set(
      [...src.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:new Date\(\s*\)|Date\.now\(\s*\))/g)].map(
        (m) => m[1],
      ),
    );
    const isInstant = (expr) => {
      const e = expr.trim();
      return /^new Date\(\s*\)$/.test(e) || /^Date\.now\(\s*\)$/.test(e) || instants.has(e);
    };

    if (!DAY_VS_INSTANT_OK.has(relf)) {
      for (const m of src.matchAll(new RegExp(`\\b(${DAY_COLUMNS})\\s*:\\s*\\{([^{}]*)\\}`, "g"))) {
        for (const bound of m[2].split(",")) {
          const idx = bound.indexOf(":");
          if (idx === -1) continue;
          if (!/^\s*(gt|gte|lt|lte|equals)\s*$/.test(bound.slice(0, idx))) continue;
          if (!isInstant(bound.slice(idx + 1))) continue;
          fail(
            "date-safety",
            relf,
            `\`${m[1]}: {${bound.trim()}}\` compares a day column to a live instant — today reads as past from 02:00 SAST`,
            "bound it with calendarDate(saToday()); decide which of TODAY's sessions are past in code, with bookingStartsAt()",
          );
        }
      }
    }

    // `setHours(0,0,0,0)` is LOCAL midnight — UTC on Vercel, SAST on a dev box.
    // It lines up with a `@db.Date` in production and is two hours out everywhere
    // else, which is how it survived review in the client-quick-view route.
    if (/\.setHours\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(src)) {
      fail(
        "date-safety",
        relf,
        "setHours(0,0,0,0) — local midnight, which is only UTC by accident of where it runs",
        "use calendarDate(saToday()) for a day, saDayStart() for a bound over a timestamp column",
      );
    }
  }
});

check("date-safety: no hardcoded +02:00 offset", () => {
  for (const f of allSource()) {
    // dates.ts owns the offset. dates.test.ts deliberately hardcodes it as a
    // fixture — its whole job is to prove bookingStartsAt() still produces the
    // same instant as the "+02:00" string form it replaced.
    if (rel(f) === "lib/dates.ts" || rel(f) === "lib/dates.test.ts") continue;
    // RAW source, not code(): a hardcoded offset only ever appears INSIDE a string
    // literal (`${d}T${t}:00+02:00`), which code() strips — so scanning the
    // stripped form could never fire. Caught by planting a probe; a check that
    // cannot fail is worse than no check, because it reports a reassuring green.
    const src = read(f).replace(/^\s*(\/\/|\*).*$/gm, "");
    if (/\+02:?00/.test(src)) {
      fail(
        "date-safety",
        rel(f),
        "hardcoded +02:00 offset",
        "use saInstant()/bookingStartsAt() — the offset lives in lib/dates.ts alone",
      );
    }
  }
});

check("date-safety: one public-holiday list", () => {
  // There were two, and they disagreed. `lib/sa-holidays.ts` carries the s2A
  // presidential proclamations — election days, the Christmas-on-a-Sunday gap —
  // which no algorithm can derive; the second copy did not. So the reschedule
  // guard refused a proclaimed holiday while recurring-series generation booked
  // straight through it, and business-day billing arithmetic used a third answer
  // depending on the import. A holiday list is exactly the kind of thing that
  // looks harmless to duplicate and then drifts silently for a year.
  const decls = allSource().filter((f) =>
    /export function isSAPublicHoliday(?:On)?\s*\(/.test(read(f)),
  );
  const owner = "lib/sa-holidays.ts";
  const strays = decls.map(rel).filter((f) => f !== owner);
  if (strays.length > 0 || !decls.map(rel).includes(owner)) {
    fail(
      "date-safety",
      strays.join(", ") || "(none)",
      `the public-holiday answer must come from ${owner} alone; found: ${decls.map(rel).join(", ") || "(none)"}`,
      "import isSAPublicHoliday (Date) or isSAPublicHolidayOn (date string) from lib/sa-holidays.ts",
    );
  }
});

check("date-safety: TIMEZONE declared exactly once", () => {
  const decls = allSource().filter((f) =>
    /(?:const|let|var)\s+TIMEZONE\s*=\s*["']Africa\/Johannesburg["']/.test(read(f)),
  );
  if (decls.length !== 1 || rel(decls[0]) !== "lib/dates.ts") {
    fail(
      "date-safety",
      decls.map(rel).join(", ") || "(none)",
      `TIMEZONE declared in ${decls.length} place(s); it must live only in lib/dates.ts`,
      "import { TIMEZONE } from '@/lib/dates'",
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. SERVER-ACTION AUTH
//
// The bug class CLAUDE.md names first: a mutating server action without
// requireRole() is an unauthenticated write endpoint. With 200+ actions, one
// missing line is invisible to review.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Split a "use server" file into its exported async functions, bounded by BRACE
 * DEPTH — not by "the next export".
 *
 * The naive version sliced each function's body from its `export async function`
 * line to the next one, which swallowed any non-exported helper sitting between
 * them. That made an innocent read-only action inherit a helper's prisma.update()
 * and get reported as an unguarded mutation. A false positive in a security check
 * is expensive: it is exactly the finding people learn to wave through.
 */
function serverActions(src) {
  const out = [];
  const re = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    // Walk to the opening brace of the function body, then to its matching close.
    let i = src.indexOf("{", m.index + m[0].length);
    if (i === -1) continue;
    let depth = 0;
    const start = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push({ name: m[1], body: src.slice(start, i + 1) });
  }
  return out;
}

const MUTATION = /prisma\.\w+\.(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw)/;

/**
 * Deliberate exceptions to `mutation-revalidate`, each with the reason it is safe.
 *
 * An entry here means "read and classified", NOT "silenced". If you add one,
 * write the reason — a bare allowlist rots into a place where real defects hide.
 */
const REVALIDATE_EXCEPTIONS = new Map([
  ["createBillingEntityAction", "returns the entity; caller chains addRelationshipAction, which revalidates. No standalone BillingEntity page exists."],
  ["recordSettingsVisitAction", "fire-and-forget visit tally, called .catch(()=>{}) — must never block navigation."],
  ["getWhatsAppTemplatesAction", "lazily seeds defaults then RETURNS the list; the client sets state from the return value, not from cache."],
  ["changeStudentPassword", "caller does router.push() + router.refresh() — the client-side equivalent."],
  ["registerStudent", "caller signs in then router.push() + router.refresh()."],
  ["saveVideoPositionAction", "debounced fire-and-forget playback position; client-owned state during playback."],
  ["saveNoteAction", "client sets local note state synchronously; the write is background persistence."],
  ["requestPasswordResetAction", "useActionState form; incidental auth-linking writes are side effects of sending the email, rendered from the return value."],
]);

/**
 * This app has three auth regimes, and a mutating action must satisfy the one
 * for its route group. Checking every action against `requireRole` would flag
 * all 40 portal actions — noise that gets the whole audit ignored.
 */
// Any spelling of a rate-limiter. There are two modules — lib/rate-limit.ts
// (`rateLimit`, `rateLimitBooking`, …) and lib/rate-limit-db.ts
// (`isRateLimitedDb`, `recordHitDb`) — and matching only the first spelling
// reported forgot-password as unguarded when it is in fact throttled on both IP
// and target email. One spelling measures a false result.
const RATE_LIMITED = /rate-?limit/i;

const AUTH_REGIME = [
  {
    // PRE-AUTH routes come first: they sit inside (portal)/(public) but cannot
    // possibly hold a session — you are registering or resetting a password
    // precisely because you have none. Their invariant is abuse-resistance,
    // not identity.
    name: "pre-auth",
    match: (p) => /\((auth)\)|\/register\/|\/forgot-password\/|\/reset-password\/|\/login\//.test(p),
    // Either is sufficient. Some actions in these folders are genuinely
    // pre-session (register, forgot-password) and must be throttled; others are
    // post-login and merely FILED here (change-password), and hold a session.
    guard: /rate-?limit|getAuthenticatedStudent\s*\(|getAuthenticatedAdmin\s*\(|requireRole\s*\(/i,
    fix: "a pre-auth mutation must be rate-limited (lib/rate-limit.ts) or hold a session guard",
  },
  {
    name: "(admin)",
    match: (p) => p.includes("(admin)"),
    guard: /requireRole\s*\(|getAuthenticatedAdmin\s*\(/,
    fix: 'add `await requireRole("super_admin", "editor")` as the first line',
  },
  {
    name: "(portal)",
    match: (p) => p.includes("(portal)"),
    guard: /getAuthenticatedStudent\s*\(|requirePasswordChanged\s*\(/,
    fix: "add `await getAuthenticatedStudent()` (or requirePasswordChanged()) as the first line",
  },
  {
    // Public mutations are unauthenticated BY DESIGN (a stranger books a session).
    // The invariant is abuse-resistance: unthrottled, they are a free write
    // endpoint for anyone on the internet.
    name: "(public)",
    match: (p) => p.includes("(public)"),
    guard: RATE_LIMITED,
    fix: "public mutations must be rate-limited — see lib/rate-limit.ts",
  },
];

check("server-action-auth: every mutating action is guarded for its route group", () => {
  for (const f of walk(APP, /actions\.ts$/)) {
    const raw = read(f);
    if (!raw.includes('"use server"') && !raw.includes("'use server'")) continue;
    const path = rel(f);
    const regime = AUTH_REGIME.find((r) => r.match(path));
    if (!regime) continue;
    const fileHasGuard = regime.guard.test(code(raw)); // module-level throttles count
    for (const fn of serverActions(code(raw))) {
      if (!MUTATION.test(fn.body)) continue; // read-only action
      if (regime.guard.test(fn.body)) continue;
      if (regime.name === "pre-auth" && fileHasGuard) continue;
      fail(
        "server-action-auth",
        `${path} → ${fn.name}`,
        `mutates the DB with no ${regime.name} guard`,
        regime.fix,
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4b-bis. SERVER-ACTION FAILURE CHANNEL
//
// This check exists because of the 2026-08-16 incident: Roxanne could not add or
// update a client, and every attempt returned "An error occurred in the Server
// Components render. The specific message is omitted in production builds…".
//
// That string is not a crash. React STRIPS the message off a server action that
// threw, in production, and hands the client a digest instead. So a `throw new
// Error("A client with this email already exists.")` — a sentence written to be
// read by a person — is guaranteed to reach that person as unreadable boilerplate.
// Catching it does not help: `err.message` IS the boilerplate.
//
// The same bug was live on the PUBLIC booking form ("Please accept the Terms &
// Conditions…", "This time slot is no longer available…") and in the client portal,
// where the audience is paying clients rather than staff.
//
// Rule: in a server action, a refusal a human is meant to read is RETURNED
// ({ success: false, error }), never thrown. Throwing is reserved for genuine
// invariants — where nobody is meant to read the message anyway.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A thrown message that is plainly addressed to a person: it contains a space and
 * either ends in sentence punctuation or uses second-person/polite phrasing. Terse
 * internal invariants ("Booking not found", "Unauthorized") are NOT matched — they
 * are developer assertions, and a digest is an acceptable outcome for those.
 */
const HUMAN_MESSAGE =
  /\b(?:you|your|please|already|no longer|cannot|can't|couldn't|we|choose another|try again|must be|insufficient|required)\b/i;

/**
 * Comments out, STRING LITERALS IN. The shared `code()` helper blanks every literal,
 * and the message is the only thing this check looks at — running against `code()`
 * made it unfailable, which is how the +02:00 check silently died. Proven by planting
 * a violation and watching it fire; see the note above.
 */
const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) || []).length))
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");

check("server-action-ux: a refusal a human reads is returned, not thrown", () => {
  const THROW = /throw new Error\(\s*([`"'])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  const ACTION = /export\s+async\s+function\s+(\w+)\s*\(/g;

  for (const f of walk(APP, /actions\.ts$/)) {
    const raw = read(f);
    if (!raw.includes('"use server"') && !raw.includes("'use server'")) continue;
    const src = stripComments(raw);
    const path = rel(f);

    // Action boundaries by offset, so a throw is attributed to its enclosing action
    // without brace-matching over un-blanked strings.
    const starts = [];
    for (let m; (m = ACTION.exec(src)); ) starts.push({ at: m.index, name: m[1] });

    for (let m; (m = THROW.exec(src)); ) {
      const message = m[2];
      if (!HUMAN_MESSAGE.test(message)) continue; // terse internal invariant — fine
      const owner = [...starts].reverse().find((s) => s.at < m.index);
      if (!owner) continue; // module-level helper, not an action surface
      fail(
        "server-action-ux",
        `${path} → ${owner.name}`,
        `throws a message written for a person ("${message.slice(0, 60)}${message.length > 60 ? "…" : ""}") — production replaces it with React's digest text, so they never see it`,
        "return { success: false, error } (or { error } where the success path redirects) and render it at the call site",
      );
    }
  }
});

check("server-action-auth: mutating API routes and inline actions are guarded", () => {
  // The check above only walks app/**/actions.ts. It cannot see two other places a
  // guarded write should live, both of which the 2026-07-12 audit flagged as blind
  // spots: API route handlers (app/api/**/route.ts) and inline `"use server"`
  // closures written directly inside a page.
  const ANY_GUARD =
    /requireRole\s*\(|getAuthenticatedAdmin\s*\(|getAuthenticatedStudent\s*\(|getOptionalStudent\s*\(|requirePasswordChanged\s*\(|verifyWebhookSignature\s*\(|isCronAuthorised\s*\(|withCronRun\s*\(|rate-?limit|auth\.getUser\s*\(|unsubscribeToken/i;

  // 1. API route handlers that mutate.
  for (const f of walk(join(APP, "api"), /route\.ts$/)) {
    const raw = read(f);
    if (!MUTATION.test(code(raw))) continue;
    // Public-by-design, low-value writes carry their own note; allow the tracking
    // pixels and the coupon oracle (now rate-limited in slice 3).
    if (/track\/(?:click|open)/.test(rel(f))) continue;
    if (!ANY_GUARD.test(raw)) {
      fail(
        "server-action-auth",
        rel(f),
        "an API route mutates the DB with no auth/rate-limit/webhook guard — invisible to the actions.ts check",
        "guard it (requireRole / getAuthenticatedStudent / a webhook signature / a rate limit)",
      );
    }
  }

  // 2. Any lib/**/*.ts that carries a top-level "use server" is an action endpoint
  //    in disguise (handled by the abuse check), but flag a MUTATING inline
  //    `"use server"` closure inside a page that guards neither itself nor via an
  //    imported action.
  for (const f of walk(APP, /page\.tsx$/)) {
    const raw = read(f);
    // inline closures: `"use server";` INSIDE a function body (indented), not the
    // file-level directive.
    if (!/\n\s+["']use server["']/.test(raw)) continue;
    if (MUTATION.test(code(raw)) && !ANY_GUARD.test(raw)) {
      fail(
        "server-action-auth",
        rel(f),
        'an inline "use server" closure in a page mutates the DB with no guard — the actions.ts check cannot see it',
        "call requireRole()/getAuthenticatedStudent(), or delegate to a guarded actions.ts function",
      );
    }
  }
});

check("mutation-revalidate: every mutating action calls revalidatePath", () => {
  for (const f of walk(APP, /actions\.ts$/)) {
    const raw = read(f);
    if (!raw.includes('"use server"') && !raw.includes("'use server'")) continue;
    for (const fn of serverActions(code(raw))) {
      if (!MUTATION.test(fn.body)) continue;
      if (REVALIDATE_EXCEPTIONS.has(fn.name)) continue;
      if (!/revalidatePath|revalidateTag|redirect\s*\(/.test(fn.body)) {
        fail(
          "mutation-revalidate",
          `${rel(f)} → ${fn.name}`,
          "mutates the DB but never revalidates — the UI will show stale data",
          "add revalidatePath('/admin/...') after the mutation, or add it to REVALIDATE_EXCEPTIONS with a reason",
        );
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. MONEY
//
// CLAUDE.md rule #1: never hardcode prices, rates or currency. `priceZarCents`
// is MISNAMED — it holds cents in whatever currency `priceCurrency` names — so a
// formatPrice() call missing its currency argument silently renders USD as ZAR.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Files where a bare formatPrice() is CORRECT because the amount is ZAR by
 * construction, not by assumption:
 *   • Course.price / HybridPackage.priceCents / DigitalProduct.priceCents are the
 *     ZAR base fields, with explicit priceUsd/Eur/Gbp siblings (see schema).
 *   • Every Order is ZAR — checkout resolves the cart in ZAR because Paystack
 *     only charges ZAR (app/api/checkout/route.ts).
 * Classified per site, not swept: the same call in a multi-currency context is a
 * defect, which is why this is a file allowlist and not a blanket rule change.
 */
const ZAR_BY_CONSTRUCTION = new Set([
  "app/(admin)/admin/(dashboard)/courses/sortable-course-list.tsx",
  "app/(admin)/admin/(dashboard)/digital-products/sortable-product-list.tsx",
  "app/(admin)/admin/(dashboard)/packages/sortable-package-list.tsx",
  "app/(admin)/admin/(dashboard)/orders/page.tsx",
  "app/(admin)/admin/(dashboard)/orders/[id]/page.tsx",
]);

/** Top-level argument count of every `fn(...)` call — balanced-paren, so a nested
 *  call in the first argument doesn't truncate it. The naive `[^,)]+` regex
 *  reported `formatPrice(map.get(id)!, pr.currency)` as a one-argument call,
 *  because it stopped at the INNER `)`. A false positive in a money check is how
 *  people learn to wave the money check through. */
function callArity(src, fnName) {
  const out = [];
  const re = new RegExp(String.raw`\b${fnName}\(`, "g");
  let m;
  while ((m = re.exec(src))) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    const inner = src.slice(start, i - 1);
    let d = 0;
    let args = inner.trim() ? 1 : 0;
    for (const ch of inner) {
      if ("([{".includes(ch)) d++;
      else if (")]}".includes(ch)) d--;
      else if (ch === "," && d === 0) args++;
    }
    out.push({ args, text: `${fnName}(${inner.slice(0, 40)})` });
  }
  return out;
}

check("money: formatPrice always passes a currency", () => {
  for (const f of allSource()) {
    if (ZAR_BY_CONSTRUCTION.has(rel(f))) continue;
    const src = code(read(f));
    const bare = callArity(src, "formatPrice").filter((c) => c.args === 1);
    if (bare.length) {
      fail(
        "money",
        rel(f),
        `${bare.length} formatPrice() call(s) with no currency: ${bare[0].text}`,
        "formatPrice(cents, currency) — derive currency from the record, never assume ZAR",
      );
    }
  }
});

check("money: no hardcoded currency in business logic", () => {
  const allow = new Set([
    "lib/region.ts",
    "lib/pricing.ts",
    "lib/utils.ts",
    "lib/settings.ts",
    // React's required default for an un-provided context. RegionProvider (server-
    // derived from domain/cookie) always wraps the tree, so this is never read.
    "lib/region-store.tsx",
    // Every Order is ZAR by design — checkout resolves the cart in ZAR because
    // Paystack only charges ZAR. Stamping any other currency on an Order row
    // would contradict the rest of the table.
    "app/(admin)/admin/(dashboard)/clients/actions.ts",
    // The revenue CHART is a single Rand-denominated bar series, so it pins
    // currency: "ZAR" deliberately rather than fabricating a mixed-currency bar.
    // International revenue needs its own series before it can appear there.
    "lib/dashboard-queries.ts",
    // Same for the Reports page — Rand-denominated financial summaries, which pin
    // currency rather than fusing USD cents into a Rand total.
    "lib/report-queries.ts",
  ]);
  for (const f of [...walk(LIB), ...walk(APP, /actions\.ts$/)].filter((p) => !isTest(p))) {
    if (allow.has(rel(f))) continue;
    const raw = read(f);
    // currency: "ZAR" as a literal default in a write path.
    const m = raw.match(/currency:\s*["']ZAR["']/g);
    if (m) {
      fail(
        "money",
        rel(f),
        `${m.length} hardcoded currency: "ZAR"`,
        "derive from booking.priceCurrency / student region / PaymentRequest.currency",
      );
    }
  }
});

/**
 * Files that may format money without going through formatPrice().
 * Each is a deliberate exception with a reason — not a silencer.
 */
const MONEY_FORMAT_ALLOW = new Set([
  "lib/utils.ts", // the SSOT itself
  // CSV export columns must be BARE NUMBERS, not symbol-prefixed strings —
  // a spreadsheet cannot sum "R 1 234,00".
  "app/(admin)/admin/(dashboard)/reports/actions.ts",
  "app/(admin)/admin/(dashboard)/invoices/actions.ts",
  // Per-currency settings INPUT fields: each currency has its own labelled field,
  // so the value is a bare number being typed, not a mixed-currency display.
  "components/admin/finance-settings-form.tsx",
  // Rand-denominated chart axes, fed by queries that pin currency: "ZAR".
  "components/admin/revenue-chart.tsx",
  "app/(admin)/admin/(dashboard)/reports/report-charts.tsx",
  "app/(admin)/admin/(dashboard)/reports/page.tsx",
]);

check("money: no local currency formatter — use formatPrice(cents, currency)", () => {
  // The SSOT is formatPrice(cents, currency) in lib/utils.ts, with 33 importers.
  // What rots is the TAIL: a local `formatCurrency`/`formatR`/`formatCents` that
  // hardcodes "R" or pins en-ZA grouping. The portal's own invoice page did this —
  // a USD client saw Rand symbols on their own invoices — and the file did not
  // contain the word "currency" anywhere, even though the query returned it.
  //
  // A centre with 33 importers still decays if nothing forbids the raw pattern.
  for (const f of allSource()) {
    if (MONEY_FORMAT_ALLOW.has(rel(f))) continue;
    const raw = read(f);

    // A local money formatter: a function whose name says money.
    const localFn = raw.match(
      /(?:function|const)\s+(fmt|format)(?:Currency|Cents|Money|Price|R|ZAR|Rand|Amount)\w*\s*[=(]/gi,
    );
    if (localFn) {
      fail(
        "money",
        `${rel(f)} → ${localFn[0].replace(/\s*[=(]$/, "")}`,
        "defines a local money formatter — it will drift from formatPrice (hardcoded 'R', or en-ZA grouping on a USD amount)",
        "import { formatPrice } from '@/lib/utils' and pass the record's own currency",
      );
    }

    // A raw currency-formatting primitive outside the SSOT.
    if (/Intl\.NumberFormat\s*\(/.test(raw) || /style:\s*["']currency["']/.test(raw)) {
      fail(
        "money",
        rel(f),
        "formats currency directly (Intl.NumberFormat / style:'currency') instead of using formatPrice",
        "import { formatPrice } from '@/lib/utils'",
      );
    }
  }
});

check("money: VAT is gated on currency", () => {
  // VAT is ZAR-only — international invoices are zero-rated. The safe form is
  //     const isVat = currency === "ZAR" ? settings.vatRegistered : false;
  // as lib/generate-payment-requests.ts does. Taking `settings.vatRegistered`
  // straight, in a scope that knows the currency, adds 15% South African VAT to
  // a USD/EUR/GBP invoice — real money, charged to a real client, silently.
  for (const f of [...walk(LIB), ...walk(APP, /actions\.ts$/)].filter((p) => !isTest(p))) {
    const src = code(read(f));
    if (!/calculateInvoiceTotals\s*\(/.test(src)) continue;
    // Flag ANY raw `settings.vatRegistered` reaching the totals calculator.
    //
    // This check originally also required the file to mention `currency` — the
    // idea being "it can't gate on what it doesn't know". That guard, added to
    // suppress false positives, produced a false NEGATIVE: it silently missed
    // adminCreateHistoricalBookingAction, which appends a line to an existing
    // payment request and re-costs it with raw vatRegistered. For a money rule
    // that is the wrong trade — a file that doesn't know the currency must go and
    // fetch it, not be excused from the rule.
    const takesVatRaw = /settings\.vatRegistered/.test(src) && !/vatApplies\s*\(/.test(src);
    if (takesVatRaw) {
      fail(
        "money",
        rel(f),
        "passes settings.vatRegistered to calculateInvoiceTotals without gating on currency — a non-ZAR invoice gets 15% SA VAT",
        'const isVat = currency === "ZAR" ? settings.vatRegistered : false;',
      );
    }
  }
});

check("money: never aggregate a cents column across currencies", () => {
  // `paidAmountCents` / `totalCents` / `priceZarCents` hold cents in the ROW's own
  // currency. Adding them across currencies renders USD as Rands — a fabricated
  // number, not a rounding error. The dashboard tile and the chart beneath it once
  // disagreed on the same page because of exactly this.
  //
  // PER QUERY, not per file. The first version of this check exempted a whole file
  // if ANY query in it carried a currency filter — so lib/report-queries.ts, which
  // has seven aggregates and (at the time) no filters, sailed through as soon as
  // one was added. A file-level guard is a hole shaped like a fix.
  //
  // It also knows TWO shapes: the Prisma `_sum`, and the plain JS `.reduce()` that
  // report-queries used. One spelling measures a false zero.
  const CENTS = /paidAmountCents|totalCents|priceZarCents/;
  const SCOPED = /currency:\s*""|priceCurrency:\s*""|by:\s*\[[^\]]*""/;

  // Every Order is ZAR by construction — checkout resolves the cart in ZAR because
  // Paystack only charges ZAR (app/api/checkout/route.ts). Summing Order cents is
  // therefore safe, and adding a currency filter there would imply a variability
  // that does not exist.
  const ORDERS_ARE_ZAR = new Set(["app/(admin)/admin/(dashboard)/orders/page.tsx"]);

  for (const f of [...walk(LIB), ...walk(APP)].filter((p) => !isTest(p))) {
    if (ORDERS_ARE_ZAR.has(rel(f))) continue;
    const src = code(read(f));

    // 1. Prisma queries that _sum or select a cents column must scope the currency.
    const re = /prisma\.\w+\.(?:aggregate|groupBy|findMany)\s*\(/g;
    let m;
    while ((m = re.exec(src))) {
      let depth = 0;
      let i = m.index + m[0].length;
      const from = i;
      do {
        if (src[i] === "{" || src[i] === "(") depth++;
        else if (src[i] === "}" || src[i] === ")") depth--;
        i++;
      } while (i < src.length && depth >= 0);
      const call = src.slice(from, i);
      // Only queries that AGGREGATE cents matter. A findMany selecting cents for
      // per-row display is fine — the row carries its own currency.
      const aggregates = /_sum:\s*\{[^}]*(?:paidAmountCents|totalCents|priceZarCents)/.test(call);
      if (aggregates && !SCOPED.test(call)) {
        fail(
          "money",
          rel(f),
          "_sum over a cents column with no currency filter or groupBy — adds cents across currencies",
          'add `currency: "ZAR"` to the where, or groupBy(["currency"]) + formatByCurrency()',
        );
      }
    }

    // 2. JS folds over a cents field: .reduce((s, i) => s + i.totalCents, 0), or
    //    map.set(k, (map.get(k) ?? 0) + inv.totalCents). These bypass Prisma
    //    entirely, so the query above cannot see them — the file must scope somehow.
    const folds =
      src.match(/\.reduce\([^)]*\+\s*\w+\.(?:paidAmountCents|totalCents|priceZarCents)/g) ?? [];
    const mapFolds =
      src.match(/\?\?\s*0\)\s*\+\s*\w+\.(?:paidAmountCents|totalCents|priceZarCents)/g) ?? [];
    const foldCount = folds.length + mapFolds.length;
    if (foldCount > 0) {
      const scopeCount = (src.match(new RegExp(SCOPED.source, "g")) ?? []).length;
      if (scopeCount === 0) {
        fail(
          "money",
          rel(f),
          `${foldCount} JS fold(s) over a cents column with no currency scoping anywhere in the file`,
          'filter the source query by currency, or group by it and render with formatByCurrency()',
        );
      }
    }
    void CENTS;
  }
});

check("money: lineItems is validated before it is written", () => {
  // `lineItems` is a Json column on invoices and payment_requests, so the type
  // annotation at the call site is the only thing "checking" it — and a Json
  // column accepts whatever it is handed. The numbers are never re-derived
  // downstream: the PDF prints totalCents verbatim, so a malformed write becomes
  // a wrong document in a client's hands weeks later.
  //
  // Same-file heuristic, honestly: it confirms the writing file also calls
  // parseLineItems, not that the parsed value is the one that reached the
  // column. That is enough to catch a NEW write site added without validation,
  // which is the actual failure mode — this audit is textual, not a type-flow
  // analyser, and pretending otherwise would be the more dangerous claim.
  // Scan the CALL, not the file. The first draft asked "does this file mention
  // lineItems and also write an invoice somewhere?", which flagged three files
  // that only read them (the PDF builder, the email sender) plus the webhook,
  // which hands its items to createInvoiceRecord — the one place that already
  // validates. A check with three false positives out of four is one people
  // learn to wave through.
  for (const f of allSource()) {
    if (rel(f) === "lib/billing-types.ts") continue; // defines the validators
    const src = code(read(f));

    for (const m of src.matchAll(/\b(?:invoice|paymentRequest)\.(?:create|update)\s*\(\s*\{/g)) {
      let depth = 1;
      let i = m.index + m[0].length;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
        i++;
      }
      const call = src.slice(m.index, i);

      // `lineItems: true` is a select, not a write.
      if (!/lineItems\s*:\s*(?!true\b)/.test(call)) continue;
      if (/parseLineItems\s*\(/.test(call)) continue;

      // Or the value is a variable this file validated on the way in — the
      // shape createInvoiceRecord uses, where one parse guards a call further
      // down. Following the identifier keeps that legal without letting an
      // unvalidated array through under a different name.
      const bound = /lineItems\s*:\s*([A-Za-z_$][\w$]*)\b/.exec(call);
      if (
        bound &&
        new RegExp(`(?:const|let)\\s+${bound[1]}\\s*=\\s*(?:await\\s+)?parseLineItems\\s*\\(`).test(src)
      ) {
        continue;
      }

      fail(
        "money",
        rel(f),
        "writes lineItems to a Json column without parseLineItems() — nothing else checks the shape, and the PDF prints these numbers verbatim",
        'wrap the array in parseLineItems(items, "<what it is>") from lib/billing-types.ts',
      );
    }
  }
});

check("money: no ?? \"ZAR\" fallback on a currency", () => {
  // Defaulting a missing currency to ZAR FAILS OPEN: ZAR is the one value that
  // turns VAT on. createManualInvoice did `params.currency ?? "ZAR"` and none of
  // its three callers passed one — so an international client's late-cancellation
  // fee would have been stamped in Rands, with 15% SA VAT on an exported service.
  // Resolve the client's real currency instead (resolveClientCurrency).
  for (const f of [...walk(LIB), ...walk(APP, /actions\.ts$/)].filter((p) => !isTest(p))) {
    // `booking.priceCurrency || "ZAR"` is fine — that is a ROW's own currency,
    // defaulted. What is not fine is defaulting a MISSING PARAMETER, because the
    // caller who forgot to pass one never learns, and VAT quietly switches on.
    const bad = read(f).match(/params\.currency\s*\?\?\s*["']ZAR["']/g);
    if (bad) {
      fail(
        "money",
        rel(f),
        `${bad.length} currency parameter defaulting to "ZAR" — fails open, since ZAR is the only value that charges VAT`,
        "resolve the client's currency (resolveClientCurrency) instead of assuming Rands",
      );
    }
  }
});

check("money: marking an invoice paid must stamp paidAt", () => {
  // Revenue is now bucketed by `paidAt` (cash received), not `billingMonth`.
  // That makes `paidAt` load-bearing: an invoice marked paid without one is
  // simply ABSENT from every revenue figure — it does not appear in the wrong
  // month, it vanishes. Silent omission from a money total is the worst failure
  // shape there is, so the write and the timestamp must never come apart.
  for (const f of [...walk(LIB), ...walk(APP)].filter((p) => !isTest(p))) {
    // Read RAW: code() blanks string literals, so the "paid" we look for would be
    // gone before we could match it.
    const raw = read(f);
    // Scope to the prisma.invoice call ITSELF. Matching any `data: { status:
    // "paid" }` in a file that merely mentions prisma.invoice flagged the BOOKING
    // and PAYMENT-REQUEST writes sitting beside it — three false positives on a
    // clean tree. A security-flavoured check that cries wolf is one people learn
    // to wave through.
    const re = /prisma\.invoice\.(?:create|update|upsert|updateMany)\s*\(/g;
    let m;
    while ((m = re.exec(raw))) {
      // Balanced-brace scan to the end of this call's argument object.
      let depth = 0;
      let i = m.index + m[0].length;
      const start = i;
      do {
        if (raw[i] === "{" || raw[i] === "(") depth++;
        else if (raw[i] === "}" || raw[i] === ")") depth--;
        i++;
      } while (i < raw.length && depth >= 0);
      const call = raw.slice(start, i);
      if (/status:\s*["']paid["']/.test(call) && !/paidAt/.test(call)) {
        fail(
          "money",
          rel(f),
          'marks an invoice paid without setting paidAt — it vanishes from every revenue total',
          "set `paidAt: new Date()` in the same write",
        );
        break;
      }
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. EMAIL SAFETY
//
// CLAUDE.md: "Email sends have .catch(console.error) — never let email failures
// crash the request." An unhandled send rejection in a cron or an action takes
// the whole run down, so one bad address stops everyone else's mail.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Senders that REJECT on failure. Only these need guarding.
 *
 * `sendAndLogTemplate` is deliberately absent: it returns a `SendResult`
 * (`{ success, error }`) and never throws, so wrapping it in a try/catch would be
 * cargo-culting. Flagging it produced 8 of 10 findings on the first run — a
 * scanner that cries wolf is one people learn to ignore, which costs more than
 * the check is worth.
 */
const THROWING_SENDS =
  /await\s+(sendEmail|sendInvoiceEmail|sendPaymentRequestEmail|sendPaymentReminder|sendDueTodayNotice|sendOverdueNotice|generateAndStoreInvoicePDF)\s*\(/;

/** Is offset `pos` inside a try block, by brace depth? */
function insideTry(src, pos) {
  const before = src.slice(0, pos);
  let depth = 0;
  const re = /\btry\s*\{|\{|\}/g;
  const stack = [];
  let m;
  while ((m = re.exec(before))) {
    if (m[0].startsWith("try")) {
      stack.push(depth);
      depth++;
    } else if (m[0] === "{") depth++;
    else {
      depth--;
      if (stack.length && stack.at(-1) === depth) stack.pop();
    }
  }
  return stack.length > 0;
}

check("email-safety: throwing sends in cron processors are guarded", () => {
  for (const f of walk(join(LIB, "cron"))) {
    const raw = read(f);
    const src = code(raw); // line-preserving, so offsets map back to the real file
    const re = new RegExp(THROWING_SENDS.source, "g");
    let m;
    while ((m = re.exec(src))) {
      const line = src.slice(0, m.index).split("\n").length;
      const stmt = src.slice(m.index, src.indexOf("\n", m.index));
      if (/\.catch\(/.test(src.slice(m.index, m.index + 400))) continue;
      if (insideTry(src, m.index)) continue;
      fail(
        "email-safety",
        `${rel(f)}:${line}`,
        `unguarded throwing send: ${stmt.trim().slice(0, 50)}`,
        "wrap in try/catch or append .catch(console.error) — one bad address must not stop the run",
      );
    }
  }
});

check("credits: a balance that gains credits gets an expiry", () => {
  // Four paths handed out credits and exactly ONE stamped `expiresAt`. So
  // whether a credit ever lapsed depended on how it arrived: bought in a package
  // or received as a gift meant never, granted through lib/credits.ts meant 180
  // days. The expiry window was switched on and applied to almost nothing.
  //
  // Any write that INCREASES a balance has to ask lib/credits.ts for the date.
  // A row created at zero (a new client's empty balance) holds no credits and is
  // deliberately not covered.
  for (const f of allSource()) {
    const relf = rel(f);
    if (relf === "lib/credits.ts") continue; // defines creditExpiry()
    const src = code(read(f));

    for (const m of src.matchAll(/sessionCreditBalance\.(upsert|create)\s*\(\s*\{/g)) {
      // Take the call's object literal by balanced braces from the match end.
      let depth = 1;
      let i = m.index + m[0].length;
      while (i < src.length && depth > 0) {
        if (src[i] === "{") depth++;
        else if (src[i] === "}") depth--;
        i++;
      }
      const call = src.slice(m.index, i);

      // Does it hand over credits? An increment, or a create with a non-zero balance.
      const grants =
        /increment:/.test(call) || /balance:\s*(?!0\b)[A-Za-z_]/.test(call);
      if (!grants) continue;

      if (!/expiresAt/.test(call)) {
        fail(
          "credits",
          relf,
          "adds credits to a balance without stamping expiresAt — those credits can never lapse",
          "await creditExpiry() from lib/credits.ts and set expiresAt on both the create and update branches",
        );
      }
    }
  }
});

check("email-safety: a marketing sender checks consent", () => {
  // POPIA s69: direct marketing needs consent. Campaigns, drip and birthday
  // senders all filtered on `consentGiven`; the dormant follow-up did not — so
  // the one channel that emails people BECAUSE they went quiet was the one that
  // never asked whether they had agreed to be contacted.
  //
  // Matched on the marketing template keys rather than on filenames, so a new
  // processor that sends one of these has to answer the same question.
  //
  // Scanned on RAW source, not code(): a template key only ever appears INSIDE a
  // string literal, and code() blanks those — the first draft of this check
  // therefore passed with the consent filter deleted. Same way the +02:00 check
  // silently never fired. A check that cannot fail is worse than no check.
  // The two halves need OPPOSITE reads, and getting that wrong made this check
  // unfailable twice over. The consent test must run on comment-stripped code:
  // the fix's own comment explains `consentGiven`, so a raw-source match stayed
  // green with the filter itself deleted — the check was reading the explanation
  // instead of the code.
  const MARKETING_KEYS = /["'`](dormant_\d+d|birthday|campaign_\w+|drip_\w+)["'`]/;
  for (const f of walk(LIB)) {
    if (isTest(f)) continue;
    const raw = read(f);
    const src = code(raw);
    if (!MARKETING_KEYS.test(raw)) continue;
    // Only files that pick their own recipients — a helper handed a student id
    // is not the place the decision belongs.
    if (!/prisma\.student\.find/.test(src)) continue;
    if (!/consentGiven/.test(src)) {
      fail(
        "email-safety",
        rel(f),
        "selects recipients for a marketing send without checking consentGiven",
        "add `consentGiven: true` to the recipient query, as campaign/drip/birthday do",
      );
    }
  }
});

check("email-safety: the couples partner invite goes through its one helper", () => {
  // Four screens create a couples booking, and each grew its own version of "tell the
  // partner". They disagreed about whether the address was validated, whether the send
  // result was read, and whether a missing address fell back to the linked partner's.
  // One of the four was fixed after an invite was refused by the provider and nobody
  // found out for a week; the other three kept the bug (dev-standards/LESSONS.md L-21).
  //
  // So the logic lives in lib/couples-invite.ts and the sites call it. A new site that
  // renders the template itself is a fifth divergence waiting to happen.
  // RAW source. The marker is a STRING LITERAL, and code() blanks those — scanning the
  // stripped text finds `""` and never fires. Caught by planting the violation and
  // watching nothing happen; it is the same trap the `+02:00` check shipped with, and
  // it is a fixture in this file's own selftest. Knowing the rule did not prevent it.
  // The template MACHINERY names every key by definition — that is its job, not a
  // second send path. Excluded by name so the exclusion is a decision on the record.
  const DEFINES_TEMPLATES = new Set([
    "lib/couples-invite.ts", // the one helper this check exists to funnel through
    "lib/email-render.ts", // the renderer registry: every key appears here
    "lib/email-templates.ts", // hardcoded fallbacks, same reason
  ]);

  for (const file of allSource().filter((f) => f.endsWith(".ts"))) {
    if (DEFINES_TEMPLATES.has(rel(file))) continue;
    const src = read(file);
    for (const m of src.matchAll(/"couples_partner_invite"/g)) {
      fail(
        "email-safety",
        `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
        "renders or sends the couples partner invite directly instead of via sendCouplesPartnerInvite()",
        "call sendCouplesPartnerInvite() from lib/couples-invite.ts — it validates, resolves the address, and READS the send result",
      );
    }
  }
});

check("email-tiers: a suppression decision goes through lib/engagement.ts", () => {
  // `emailPaused` was consulted directly by four senders, each deciding for itself
  // what a pause meant. It meant the same thing to all of them — don't send — which
  // was right for campaigns and wrong for everything else, because the flag is set
  // AUTOMATICALLY by a cold-contact rule reading a tracking pixel that Outlook
  // blocks by default. 65 of 181 clients were auto-paused, every one by the rule and
  // not one by a person; the practice owner stopped receiving her own birthday email
  // for five months, and clients could lose paid-for session credits with no warning.
  //
  // The three tiers (marketing / goodwill / account) and which suppressions bind to
  // each now live in one file. A sender reading the raw flag is a fifth opinion.
  const DECIDES_TIERS = new Set([
    "lib/engagement.ts", // the one file allowed to read the raw flag
  ]);

  // codeKeepingLiterals: the field name appears in Prisma selects as a bare
  // identifier, but the surrounding narrative comments name it constantly — this
  // check would otherwise fire on every file that merely explains itself.
  for (const file of allSource()) {
    if (DECIDES_TIERS.has(rel(file))) continue;
    // `.ts` only. A component branching on the flag is RENDERING it — showing an
    // admin that a client is paused is the visibility this incident was missing,
    // not a send decision. Scoped by extension rather than by an allowlist of
    // component paths, so a new component showing the same badge needs no entry.
    if (file.endsWith(".tsx")) continue;
    const src = codeKeepingLiterals(read(file));
    // A `select`/`include` naming the column is fine — reading it is how a predicate
    // gets its input. Branching on it is the defect.
    const m = /(?:!|\bif\s*\(|&&|\|\||\?)\s*[\w.]*\bemailPaused\b(?!\s*:)/.exec(src);
    if (!m) continue;
    fail(
      "email-tiers",
      `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
      "branches on emailPaused directly instead of asking which tier of email this is",
      "call mayReceiveMarketing / mayReceiveGoodwill / mayReceiveAccountNotice from lib/engagement.ts — an automatic pause must not suppress a birthday wish or a credit-expiry warning",
    );
  }
});

check("email-tracking: a tracked link is one the redirector will forward", () => {
  // The wrapper and the click redirector enforce two halves of ONE rule, and for a
  // while only one half knew it. `app/api/track/click` was hardened to forward to our
  // own hosts only — correctly; it had been an open redirector on the practice's own
  // domain, which is exactly what a phishing link wants to be. But `injectTracking`
  // went on wrapping EVERY link in every email, so the Teams "Join your session" link
  // became a tracked URL the redirector then refused, and the client who clicked Join
  // got a page reading `{"error":"Untrusted URL"}` (§6, 2026-08-19).
  //
  // Nothing failed. The email sent, the link rendered, the endpoint answered exactly as
  // designed. Each half was right on its own, which is why this needs a check rather
  // than a reviewer: the defect lived in the gap between two files.
  //
  // RAW source, not code(): the marker sits inside a template literal, and code() blanks
  // those wholesale — the same trap that kept the `+02:00` check silent for months.
  const marker = "/api/track/click?t=";

  for (const file of allSource()) {
    const src = read(file);
    if (!src.includes(marker)) continue;
    if (src.includes("isTrackableTarget")) continue;
    fail(
      "email-tracking",
      `${rel(file)}:${src.slice(0, src.indexOf(marker)).split("\n").length}`,
      "builds a click-tracking URL without checking the redirector will accept the destination",
      "gate it on isTrackableTarget() from lib/email-tracking.ts — an external link goes out untracked rather than broken",
    );
  }

  // One predicate, one definition. A second copy is how the first one drifted: the
  // list this replaced named life-therapy.co.za and not life-therapy.online, so the
  // international domain was the one treated as foreign.
  for (const file of allSource()) {
    if (rel(file) === "lib/region.ts") continue; // the SSOT
    const src = read(file);
    const m = /function\s+isOurHost\b/.exec(src);
    if (!m) continue;
    fail(
      "email-tracking",
      `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
      "defines a second isOurHost — the wrapper and the redirector must not be able to disagree",
      "import isOurHost from lib/region.ts, which derives the list from REGION_CONFIG",
    );
  }

  // The legacy repair forwards a foreign URL only when it exactly matches a Teams
  // link already stored on a booking — a lookup against data we hold, not a list of
  // hosts we trust. The tempting "simplification" is `hostname === "teams.microsoft.com"`,
  // which restores the open redirector: any attacker-chosen Teams URL would pass, and
  // a redirector on the practice's own domain is what a phishing link wants to be.
  //
  // codeKeepingLiterals, not code(): the host is a STRING LITERAL and code() blanks
  // those, so this would scan `""` and never fire. It is also why the prose above can
  // name the host freely — comments are stripped, so this check cannot match its own
  // documentation.
  const REDIRECT_DECIDERS = ["app/api/track/click/route.ts", "lib/email-tracking.ts"];
  for (const file of allSource()) {
    if (!REDIRECT_DECIDERS.includes(rel(file))) continue;
    const src = codeKeepingLiterals(read(file));
    const m = /["'`][^"'`]*teams\.microsoft\.com[^"'`]*["'`]/.exec(src);
    if (!m) continue;
    fail(
      "email-tracking",
      `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
      "hardcodes a foreign host in the redirect decision — that is the open redirector again",
      "keep the lookup against stored teamsMeetingUrl values; a host allowlist trusts URLs an attacker can choose",
    );
  }
});

check("email-safety: a hardcoded template escapes client-supplied values", () => {
  // The sibling of the placeholder-substituter check below. That one covers the
  // DB-template path; this covers the hardcoded fallbacks, where the same values
  // are interpolated into HTML by hand.
  //
  // The escaping had reached 6 of 22 sites. `giftReceivedEmail` is the shape in
  // miniature: `params.message` and `params.buyerName` were escaped inside the
  // quoted-message block — the part someone clearly thought about — and the SAME
  // `buyerName` sat unescaped in the prose two lines below it.
  //
  // SUBJECT LINES ARE EXEMPT, and not as a concession: a subject is plain text, so
  // escaping one shows the reader a literal `&amp;` in their inbox. The fix would
  // become the bug. That is why this scans the HTML bodies only.
  const FIELDS =
    "clientName|clientEmail|clientPhone|clientNotes|customerName|buyerName|recipientName|" +
    "senderName|studentName|firstName|lastName|message|giftMessage|note|itemTitle";
  const RE = new RegExp(String.raw`\$\{([^}]*\b(?:${FIELDS})\b[^}]*)\}`, "g");

  // ONLY the hand-built templates. lib/email-render.ts is deliberately excluded: it
  // escapes CENTRALLY via escapeTemplateVariables() before a value ever reaches a
  // template, with RAW_HTML_VARIABLES naming the handful that must stay raw. Its
  // interpolations therefore look unescaped and are not — flagging them would have
  // been 19 false positives on the first run, and "fix" would have meant escaping
  // twice. The placeholder-substituter check below is what covers that path.
  for (const file of ["lib/email-templates.ts"]) {
    const abs = join(ROOT, file);
    if (!existsSync(abs)) continue;
    const lines = read(abs).split("\n");

    lines.forEach((line, i) => {
      if (/subject:/.test(line)) return; // plain text — see above
      for (const m of line.matchAll(RE)) {
        if (/escapeHtml\s*\(/.test(m[1])) continue;
        fail(
          "email-safety",
          `${file}:${i + 1}`,
          `interpolates \`${m[1].trim()}\` into HTML without escaping — a client-supplied value`,
          "wrap it in escapeHtml(); leave subject lines alone, they are plain text",
        );
      }
    });
  }
});

check("email-safety: every placeholder substituter escapes its variables", () => {
  // There are FIVE copies of `replacePlaceholders` in lib/. #18 escaped one of
  // them — the one inside email-render — and left campaigns, drip, campaign-send
  // and birthday substituting client-supplied values straight into HTML. A
  // `firstName` reaches the database from the public booking form and from the
  // unauthenticated newsletter signup, so "admin-authored template" does not mean
  // "admin-authored content".
  //
  // The lesson this encodes is the day's recurring one: the bug was never the
  // missing idea, it was the site the idea had not reached. So the check is on
  // the SHAPE — anything that substitutes placeholders must escape — rather than
  // on the four files that happened to be wrong.
  for (const f of walk(LIB)) {
    if (isTest(f)) continue;
    const relf = rel(f);
    if (relf === "lib/email-render.ts") continue; // defines escapeTemplateVariables
    const src = code(read(f));
    if (!/function replacePlaceholders\s*\(/.test(src)) continue;
    if (!/escapeTemplateVariables\s*\(/.test(src)) {
      fail(
        "email-safety",
        relf,
        "has its own replacePlaceholders but never escapes the variables it substitutes",
        "pass the map through escapeTemplateVariables() from lib/email-render.ts first",
      );
    }
  }
});

check("email-safety: only registered variables carry HTML into a template", () => {
  // Every value handed to renderEmail() is escaped except the names registered in
  // RAW_HTML_VARIABLES. That list is the entire injection surface, so a call site
  // that passes markup under an unregistered name is either (a) about to have its
  // markup escaped and rendered as visible tags, or (b) a new bypass nobody
  // decided on. Both want a human.
  //
  // The bug this defends: `clientName` from the PUBLIC booking form went into the
  // confirmation email and the admin notification unescaped — anyone could have
  // had a link of their choosing delivered from the practice's own domain, over
  // its DKIM signature.
  const renderSrc = read(join(LIB, "email-render.ts"));
  const listMatch = /const RAW_HTML_VARIABLES = new Set\(\[([\s\S]*?)\]\)/.exec(renderSrc);
  if (!listMatch) {
    fail(
      "email-safety",
      "lib/email-render.ts",
      "RAW_HTML_VARIABLES is gone — either escaping was removed, or the allowlist was renamed",
      "restore the registry; it is what the audit reads to tell a block from a value",
    );
    return;
  }
  const registered = new Set([...listMatch[1].matchAll(/"(\w+)"/g)].map((m) => m[1]));

  for (const f of allSource()) {
    if (rel(f) === "lib/email-render.ts") continue;
    const src = read(f); // RAW: the markup only ever lives inside a string literal
    let i = 0;
    while ((i = src.indexOf("renderEmail(", i)) !== -1) {
      let depth = 0;
      let j = i + "renderEmail(".length - 1;
      const start = j;
      do {
        if (src[j] === "(") depth++;
        else if (src[j] === ")") depth--;
        j++;
      } while (depth > 0 && j < src.length);
      const call = src.slice(start, j);
      i = j;

      // `key: <something containing a tag>` — template literal or quoted string.
      for (const m of call.matchAll(/(\w+):\s*(?:`[^`]*<[a-zA-Z/][^`]*`|"[^"]*<[a-zA-Z/][^"]*")/g)) {
        if (registered.has(m[1])) continue;
        fail(
          "email-safety",
          `${rel(f)} → ${m[1]}`,
          `passes HTML to renderEmail under an unregistered name — it will be escaped and shown as tags`,
          "add it to RAW_HTML_VARIABLES in lib/email-render.ts (with the reason), and escape whatever the block interpolates",
        );
      }
    }
  }
});

check("email-safety: every rendered template key has a hardcoded fallback", () => {
  // renderEmail() prefers the DB template and falls back to renderFallback()'s
  // switch. Four keys had NO case and fell to `default:` — subject
  // "Email: booking_cancellation", body "<p>Template not found.</p>" — while
  // sendEmail() STILL REPORTED SUCCESS. Masked only because the seed marks those
  // templates active, and the admin UI lets anyone toggle isActive off.
  //
  // A silent client-facing send failure that reports success is the worst shape
  // there is. This check is mechanical and would have caught it on day one.
  const renderer = join(LIB, "email-render.ts");
  if (!existsSync(renderer)) return;
  const src = read(renderer);

  const cases = new Set(
    [...src.matchAll(/case\s+["']([a-z0-9_]+)["']\s*:/g)].map((m) => m[1]),
  );

  const rendered = new Set();
  for (const f of allSource()) {
    for (const m of read(f).matchAll(/renderEmail\(\s*["']([a-z0-9_]+)["']/g)) {
      rendered.add(m[1]);
    }
  }

  for (const key of [...rendered].sort()) {
    if (!cases.has(key)) {
      fail(
        "email-safety",
        `lib/email-render.ts → "${key}"`,
        `renderEmail("${key}") is called, but renderFallback has no case for it — if the DB template is deactivated the client silently receives "Template not found", and the send still reports success`,
        `add a case "${key}": to renderFallback(), using exactly the variables the call site passes`,
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4a. THE DUAL-DOMAIN SEAM
//
// life-therapy.co.za (ZAR) and life-therapy.online (international) are served by
// ONE deployment; region is decided per-request from the hostname. So a hardcoded
// domain literal in an email/PDF is wrong for exactly the clients on the OTHER
// domain — booking-cancellation links went to .co.za for international clients,
// and the certificate footer printed .online onto every SA client's certificate.
//
// The literal belongs in lib/region.ts (the region → domain map) and nowhere else.
// Everyone else derives it: getBaseUrl() from the request, or
// getBaseUrlForCurrency(currency) when emailing someone else's record.
// ═══════════════════════════════════════════════════════════════════════════

const DOMAIN_LITERAL_ALLOW = new Set([
  "lib/region.ts", // the region → domain map — where the literal is SUPPOSED to live
  "app/layout.tsx", // hreflang / canonical — legitimately names both domains
  "lib/email-render.ts", // SAMPLE_DATA preview block + the DEFAULT_BASE_URL last-resort fallback
  "lib/email-templates.ts", // hardcoded fallback templates, same last-resort fallback
  "next.config.mjs",
  // Admin-authored DEFAULT template footers, edited per campaign before send, and
  // the admin-only drip PREVIEW page — not a client-facing send path.
  "app/(admin)/admin/(dashboard)/campaigns/new/campaign-editor.tsx",
  "app/(admin)/admin/(dashboard)/campaigns/new/birthday-campaign-editor.tsx",
  "app/(admin)/admin/(dashboard)/drip-emails/[id]/page.tsx",
]);

check("dual-domain: no hardcoded life-therapy domain in a client-facing path", () => {
  // Match the domain with an https:// prefix or a "/book"-style path after it —
  // i.e. a URL, not an email address (hello@life-therapy.co.za is a shared inbox,
  // and the regex below deliberately does not match a bare address).
  const RE = /https?:\/\/life-therapy\.(?:co\.za|online)|life-therapy\.(?:co\.za|online)\/\w/;
  for (const f of allSource()) {
    if (DOMAIN_LITERAL_ALLOW.has(rel(f))) continue;
    const raw = read(f).replace(/^\s*(?:\/\/|\*).*$/gm, ""); // drop comment lines
    if (RE.test(raw)) {
      const m = RE.exec(raw);
      fail(
        "dual-domain",
        rel(f),
        `hardcoded domain URL (${m[0]}) — wrong for clients on the other domain`,
        "getBaseUrl() (request context) or getBaseUrlForCurrency(currency) (emailing someone's record)",
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4b. ABUSE SURFACE
//
// lib/rate-limit.ts keeps its counter in a Map inside ONE lambda. On Vercel each
// warm instance has its own, and it resets on every cold start — so the real
// ceiling is `limit × instances`, not `limit`. That is fine for bounding a
// scraper. It is not a limit on something that creates a real record: public
// booking creation takes a slot in a finite diary, fires a Graph event and sends
// email, and it sat on the in-memory limiter while login and password-reset were
// already on the durable one.
// ═══════════════════════════════════════════════════════════════════════════

check("abuse: an MFA/OTP verify is rate-limited", () => {
  // The password path had a limiter; the second factor had none. A six-digit
  // code with a ~30-90s validity is only as strong as the number of guesses that
  // fit in the window, so an unlimited verify endpoint is the weakest link in an
  // account protected by 2FA — and the existing `server-action-auth` check
  // structurally cannot see it, because that one only inspects functions that
  // touch prisma.*.create/update, and verifying a code touches Supabase.
  const VERIFY = /\.mfa\.(?:verify|challengeAndVerify)\s*\(/;
  const GUARD = /isRateLimitedDb|checkAndRecord|rate-limit-db/;
  for (const f of walk(APP)) {
    if (isTest(f)) continue;
    const raw = read(f);
    if (!VERIFY.test(code(raw))) continue;
    if (!GUARD.test(raw)) {
      fail(
        "abuse",
        rel(f),
        "verifies an MFA/OTP code with no durable rate limit",
        "guard with isRateLimitedDb/recordHitDb keyed on the user id — see app/(public)/login/mfa/actions.ts",
      );
    }
  }
});

check("abuse: high-value public writes use the DURABLE limiter", () => {
  // The in-memory limiter is fine for read-ish endpoints (slot lookups,
  // newsletter). It is not fine for anything that creates a booking or a student.
  const IN_MEMORY = /\brateLimit(?:Booking|Register|Newsletter|Api)?\s*\(/;
  // `upsertContact` is here because the check reads ONE FILE AT A TIME, and the
  // newsletter route's `prisma.student.upsert` lives inside lib/contacts.ts. The
  // route therefore looked read-only to this regex, was allowlisted as
  // "low-value", and kept the in-memory limiter on an endpoint that creates
  // client records. A write behind a helper is still a write.
  const HIGH_VALUE = /prisma\.(?:booking|student)\.(?:create|upsert)|\bupsertContact\s*\(/;
  const ALLOW = new Set([
    "lib/rate-limit.ts", // the module itself
    // Genuinely read-only: no row is created, so bounding scrapers is all these
    // need. Verified per site rather than assumed from the path.
    "app/api/booking/available-slots/route.ts",
    "app/api/booking/available-dates/route.ts",
    // NOTE: app/api/newsletter/subscribe/route.ts used to sit here on the
    // grounds that it was "low-value". It calls upsertContact, which writes a
    // students row. Migrated to the durable limiter 2026-08-18 and removed from
    // this list — the entry was the reason nobody looked.
  ]);
  for (const f of [...walk(APP)].filter((p) => !isTest(p))) {
    if (ALLOW.has(rel(f))) continue;
    const src = code(read(f));
    if (!HIGH_VALUE.test(src)) continue;
    if (IN_MEMORY.test(src) && !/rate-limit-db|checkAndRecord|isRateLimitedDb/.test(read(f))) {
      fail(
        "abuse",
        rel(f),
        "creates a booking/student but throttles with the IN-MEMORY limiter — on Vercel that is per-lambda, so the real ceiling is limit × warm instances",
        "use lib/rate-limit-db.ts (rateLimitBookingDb / rateLimitRegisterDb / checkAndRecord)",
      );
    }
  }
});

check("abuse: no 'use server' in lib/ — it makes every export an endpoint", () => {
  // A `"use server"` at the TOP of a library file turns every export into a
  // server-action endpoint any client component can invoke by importing it.
  // lib/contacts.ts carried it, and its upsertContact() writes to `students` with
  // no guard of its own. Never exploited (all importers were server-side), but it
  // was an unguarded endpoint in waiting — and invisible to the server-action
  // check, which only walks app/**/actions.ts.
  //
  // Actions belong in an actions.ts file with a guard. Libraries are libraries.
  for (const f of walk(LIB).filter((p) => !isTest(p))) {
    const first = read(f).split("\n").slice(0, 3).join("\n");
    if (/^\s*["']use server["']/m.test(first)) {
      fail(
        "abuse",
        rel(f),
        'has a top-level "use server" — every export becomes a callable endpoint, bypassing the server-action auth check',
        "drop the directive and call it as a library from guarded server code, or move it into an actions.ts with a guard",
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 4c. ENV ACCESS
//
// A var read raw at its point of use is discovered MISSING only there, mid-request
// — the "June-outage" class. lib/env.ts declares every server var once, reads it
// through a validating accessor, and asserts the required set from the daily cron.
// Raw `process.env` elsewhere reopens the hole.
// ═══════════════════════════════════════════════════════════════════════════

const ENV_ALLOW = new Set([
  "lib/env.ts", // the accessor itself
  // Bundler requirement: NEXT_PUBLIC_* must be a literal member-access so the
  // Next.js compiler can inline it into the client bundle — a function would leave
  // `undefined` in the browser. (The regex below already skips NEXT_PUBLIC_*; these
  // files are listed for the reads that AREN'T NEXT_PUBLIC.)
  "lib/prisma.ts", // DATABASE_URL — hard dependency, guarded at the client constructor
  "lib/supabase.ts",
  "lib/supabase-server.ts",
  "lib/supabase-admin.ts",
  "lib/supabase/middleware.ts",
  "lib/supabase/config.ts",
  "lib/cron/with-cron-run.ts", // CRON_SECRET — its own single guarded reader
  "lib/audit.ts", // AUDIT_IP_HMAC_KEY — same
  // TEST-ONLY, and a WRITE not a read: pins process.env.TZ = "UTC" so the payload suite
  // is deterministic regardless of the CI machine's timezone (buildRecurrence parses a
  // naive wall-clock string in the ambient zone — under Pacific/Auckland 11 tests flip).
  // TZ is not a server var and has no lib/env.ts accessor; nothing is read here.
  "lib/test-tz.ts",
]);

check("env: no raw process.env for a server var outside lib/env.ts", () => {
  // NEXT_PUBLIC_* and NODE_ENV are exempt: the first is a bundler literal, the
  // second is framework config, not a secret.
  const RAW = /process\.env\.(?!NEXT_PUBLIC_|NODE_ENV\b)([A-Z][A-Z0-9_]*)/g;
  for (const f of allSource()) {
    if (ENV_ALLOW.has(rel(f))) continue;
    const src = code(read(f)); // comments/strings stripped
    const names = new Set();
    let m;
    while ((m = RAW.exec(src))) names.add(m[1]);
    if (names.size > 0) {
      fail(
        "env",
        rel(f),
        `reads ${[...names].join(", ")} straight from process.env — a missing value is discovered mid-request, not at boot`,
        "read it through lib/env.ts: env() / requireEnv() / envOr() / isConfigured()",
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. SECRETS
//
// Two shapes, both found in the 2026-07-12 centralisation audit:
//
//   • A secret with more than one reader drifts. `daily/route.ts` hand-rolled the
//     cron auth check that `isCronAuthorised` already implemented — so removing
//     the `?secret=` query-param path (a live credential in Vercel access logs and
//     browser history) would have silently missed the single highest-value
//     endpoint in the system, the orchestrator for all ten jobs.
//
//   • A secret with a hardcoded fallback is not a secret. `lib/audit.ts` hashed
//     IPs with `SERVICE_ROLE_KEY || "lt-auth-…-key"` — a literal committed to this
//     repo. IPv4 is only 2^32 values, so with a public key every "hashed" IP is
//     reversible by brute force. The guard silently degraded to no guard while the
//     column still LOOKED protected, which is worse than storing the raw IP.
// ═══════════════════════════════════════════════════════════════════════════

check("secrets: CRON_SECRET has exactly one reader", () => {
  const readers = allSource().filter((f) => /process\.env\.CRON_SECRET/.test(code(read(f))));
  if (readers.length !== 1 || rel(readers[0]) !== "lib/cron/with-cron-run.ts") {
    fail(
      "secrets",
      readers.map(rel).join(", ") || "(none)",
      `CRON_SECRET is read in ${readers.length} file(s) — exactly one may know its name`,
      "call isCronAuthorised(req) / withCronRun() instead of re-implementing the check",
    );
  }
});

check("secrets: the cron secret is never read from the URL", () => {
  // A credential in a query string is written to Vercel's access logs, kept in
  // browser history, and leaked in the Referer of any outbound request. Headers only.
  const helper = join(LIB, "cron", "with-cron-run.ts");
  if (existsSync(helper) && /searchParams/.test(code(read(helper)))) {
    fail(
      "secrets",
      "lib/cron/with-cron-run.ts",
      "isCronAuthorised reads the secret from the query string",
      "accept it as a header only (Authorization: Bearer …, or x-cron-secret)",
    );
  }
  for (const f of walk(join(APP, "api"))) {
    if (!/\/cron\//.test(rel(f))) continue;
    const raw = read(f);
    if (/searchParams\.get\(\s*["']secret["']\s*\)/.test(raw)) {
      fail(
        "secrets",
        rel(f),
        "reads the cron secret from the query string",
        "call isCronAuthorised(req) — headers only",
      );
    }
  }
});

check("secrets: no hardcoded fallback for a secret", () => {
  // `process.env.SOME_KEY || "a-literal"` means the LITERAL is the secret whenever
  // the env var is unset — and the literal is in the repo. For a signing/HMAC key
  // that is indistinguishable from no protection at all. A URL or email default is
  // fine; a key default is not.
  const SECRETISH = /(?:KEY|SECRET|TOKEN|PASSWORD|HMAC|SALT)$/;
  for (const f of allSource()) {
    const raw = read(f);
    const re = /process\.env\.([A-Z0-9_]+)\s*(?:\|\||\?\?)\s*["'`]([^"'`\n]{6,})["'`]/g;
    let m;
    while ((m = re.exec(raw))) {
      const [, name, literal] = m;
      if (!SECRETISH.test(name)) continue;
      fail(
        "secrets",
        `${rel(f)} → ${name}`,
        `falls back to a hardcoded literal (${JSON.stringify(literal.slice(0, 20))}) — that literal IS the secret whenever the var is unset`,
        "fail closed: throw, or skip the protected write — never use a value committed to the repo",
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. SCHEMA / MIGRATIONS
//
// `prisma migrate` does not work here (the pgbouncer pooler). DDL goes through
// the Supabase Management API. A stray migration folder means someone tried.
// ═══════════════════════════════════════════════════════════════════════════

check("schema: no prisma migrate invocations in scripts", () => {
  const pkg = JSON.parse(read(join(ROOT, "package.json")));
  for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
    if (/prisma\s+(migrate|db\s+push)/.test(cmd)) {
      fail(
        "schema",
        `package.json → scripts.${name}`,
        "invokes prisma migrate/db push, which does not work on this project",
        "apply DDL via the Supabase Management API — see .claude/rules/schema-changes.md",
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. CALENDAR
//
// A cancelled booking whose Outlook event is left standing is invisible from
// every screen we own: the row goes grey, the portal says "cancelled", and the
// client still has the meeting. It surfaces when they turn up.
//
// This happened. `adminCancelBookingAction` and `adminLateCancelWithFeeAction`
// on the client detail page cancelled bookings for months without one Graph
// call between them — Cheslon Faroa's 10 Sep session sat live in Outlook from
// 13 Aug, with no calendar_sync_log row to show for it, because nothing was
// ever attempted. Not a wrong branch. A missing one, in a file whose siblings
// all had it — which is why no reviewer reading a diff would see anything odd.
// ═══════════════════════════════════════════════════════════════════════════

check("calendar: a cancel path removes the calendar event", () => {
  // NOTE: this scans RAW source, not code(). The marker it hunts for is the string
  // literal `status: "cancelled"`, and code() blanks string literals — so the
  // stripped version contains `status: ""` and the check can never fire. That is
  // the exact way the +02:00 check sat green for months. A comment cannot fake a
  // hit here, because the second half of the test is the ABSENCE of a call.
  const files = walk(join(ROOT, "app")).filter((f) => f.endsWith("actions.ts"));

  // Only bookings own a calendar event. Invoices and payment requests carry a
  // `status: "cancelled"` of their own and must not be dragged in.
  // `[^;]` keeps the match inside ONE statement. Without it the pattern happily
  // spanned a `prisma.booking.updateMany(...)` and a LATER `recordAudit({ after:
  // { status: "cancelled" } })`, flagging three invoice-voiding actions that never
  // go near a booking's status.
  const CANCELS_A_BOOKING = /prisma\.booking\.update(?:Many)?\([^;]{0,400}?status:\s*"cancelled"/;

  for (const file of files) {
    const src = read(file);
    if (!CANCELS_A_BOOKING.test(src)) continue;

    // Split on top-level `export async function` / `async function` boundaries.
    for (const part of src.split(/\n(?=(?:export )?async function )/)) {
      if (!CANCELS_A_BOOKING.test(part)) continue;

      const name = /(?:export )?async function (\w+)/.exec(part)?.[1] ?? "(anonymous)";

      // Matched against comment-stripped text so prose about the calendar cannot
      // stand in for reaching it. Series-wide cancels remove their events in a
      // grouped pass, which still lands inside the same function.
      const touchesCalendar =
        /removeBookingFromCalendar|deleteRecurringEventOccurrences|cancelCalendarEvent/.test(
          code(part),
        );
      if (touchesCalendar) continue;

      fail(
        "calendar",
        `${rel(file)} → ${name}`,
        "cancels a booking without removing its calendar event",
        "call removeBookingFromCalendar(booking) — see lib/calendar-removal.ts",
      );
    }
  }
});

check("calendar: removal shape is not inferred from recurringSeriesId", () => {
  // `recurringSeriesId` answers a question about the BOOKING; what decides the
  // delete is whether `graphEventId` is a series MASTER. Branching on the first
  // to choose between the two Graph deletes conflates them — it deleted fifty
  // sessions in July 2026. lib/calendar-removal.ts counts instead.
  const files = [
    ...walk(join(ROOT, "app")).filter((f) => f.endsWith(".ts")),
    ...walk(join(ROOT, "lib")).filter((f) => f.endsWith(".ts")),
  ];

  for (const file of files) {
    if (rel(file) === "lib/calendar-removal.ts") continue;
    const src = code(read(file));

    // The shape: a recurringSeriesId condition, then an occurrence delete, then
    // an else reaching for the whole-event cancel — within a few lines.
    const re =
      /recurringSeriesId\s*\)[\s\S]{0,320}?deleteRecurringEventOccurrences[\s\S]{0,320}?\belse\b[\s\S]{0,200}?cancelCalendarEvent/g;
    for (const m of src.matchAll(re)) {
      const line = src.slice(0, m.index).split("\n").length;
      fail(
        "calendar",
        `${rel(file)}:${line}`,
        "picks the calendar delete by recurringSeriesId instead of by who holds the event id",
        "call removeBookingFromCalendar(booking) — see lib/calendar-removal.ts",
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. HOOKS — the layer that survives context loss, but not itself
//
// A hook reaches every context unconditionally: subagents, narrow tasks,
// sessions where a path-scoped rule file never loaded. That is what makes it
// safe to move prose out of the always-loaded instruction file at all —
// without it, cutting prose would be cutting protection.
//
// But a hook has one failure nobody sees. Rename its script, break its path,
// and Claude Code reports a non-blocking status that scrolls past. Every rule
// held there ALONE then degrades without failing: deny becomes ask, ask
// becomes allow. Nothing goes red. Measured here on 2026-08-18: of five gates,
// two had no settings-level twin at all (rm -rf on root, ad-hoc production SQL)
// and one degraded deny→ask.
//
// So each incident-class gate names a twin in settings.json, and this check is
// the set difference. Deliberately NOT equal-or-stronger: settings speaks in
// prefix-globs, the hook in separator-aware regex, and a coarse deny in the
// dumb layer false-positives forever (see the heredoc scar in bash-gate.js).
// Ask is the floor; absent is the violation.
// ═══════════════════════════════════════════════════════════════════════════

check("hooks: every hook is registered, and every registration resolves", () => {
  // The registration gap, found by review of a sibling project and confirmed here: the
  // twin check below reads `permissions.deny` and `permissions.ask` and never once looks
  // at `settings.hooks`. So a hook could exist, declare its twins, carry probe records,
  // ship a passing test suite — and not be wired to any PreToolUse matcher at all. Every
  // artefact would say the control exists. Nothing would run it.
  //
  // Not hypothetical: disabling a gate during the harness experiments was done by
  // RENAMING its file, and nothing here would have noticed a failure to restore it.
  //
  // Two directions, because they fail differently. An unregistered file is a control
  // that never runs and looks complete. A registration pointing at a missing file is
  // L-16's shape — the hook errors, the harness reports a non-blocking status nobody
  // reads, and the rule it alone held degrades in silence.
  const hookDir = join(ROOT, ".claude/hooks");
  const settingsPath = join(ROOT, ".claude/settings.json");
  if (!existsSync(hookDir) || !existsSync(settingsPath)) return; // the twin check reports this

  const settings = JSON.parse(read(settingsPath));
  const events = Object.entries(settings.hooks ?? {});
  const commands = [];
  for (const [event, entries] of events) {
    for (const entry of entries ?? []) {
      for (const h of entry.hooks ?? []) {
        commands.push({ event, matcher: entry.matcher, command: String(h.command ?? "") });
      }
    }
  }

  // 1. Every hook FILE is wired to something.
  const hookFiles = readdirSync(hookDir).filter((f) => /\.js$/.test(f) && !/\.test\./.test(f));
  for (const f of hookFiles) {
    const registered = commands.some((c) => c.command.includes(f));
    if (!registered) {
      fail(
        "hooks",
        `.claude/hooks/${f}`,
        "is not registered in settings.json — it exists, tests green, and never runs",
        "add it under hooks.PreToolUse with a matcher, or delete the file so nothing reads as a control that is not one",
      );
    }
  }

  // 2. Every registration points at a file that is there, and names what it matches.
  for (const c of commands) {
    const named = /\.claude[\\/]hooks[\\/]([\w.-]+\.m?js)/.exec(c.command);
    if (named && !existsSync(join(hookDir, named[1]))) {
      fail(
        "hooks",
        ".claude/settings.json",
        `${c.event} registers ${named[1]}, which does not exist`,
        "a hook that cannot start fails non-blocking and silently — restore the file or drop the registration",
      );
    }
    if (!c.matcher) {
      fail(
        "hooks",
        ".claude/settings.json",
        `a ${c.event} entry has no matcher`,
        "give it an explicit matcher — an absent one is a scope nobody chose",
      );
    }
  }
});

check("hooks: every hook declares its twin or why it cannot have one", () => {
  // This check was named "every incident-class gate" and read exactly ONE file. ddl-gate
  // — the gate standing between a script and production DDL — was never in scope, so
  // "every" was doing work the code did not do. The same partial-defence shape the
  // ledger records (L-21), inside the check written to reconcile defences.
  //
  // Every hook now either carries @twin markers or an explicit @no-twin with a reason.
  // ddl-gate takes the second: settings patterns match tool and PATH, and its question is
  // about CONTENT, so no path-based twin can express it.
  const hookDir = join(ROOT, ".claude/hooks");
  if (existsSync(hookDir)) {
    for (const f of readdirSync(hookDir).filter((f) => /\.js$/.test(f))) {
      const src = read(join(hookDir, f));
      const hasTwin = /^\s*\/\/\s*@twin\s+\S/m.test(src);
      const hasNoTwin = /@no-twin\s+\S/.test(src);
      if (!hasTwin && !hasNoTwin) {
        fail(
          "hooks",
          `.claude/hooks/${f}`,
          "declares neither a settings twin nor @no-twin with a reason",
          "add `// @twin <settings pattern>` per rule, or `@no-twin <why the settings layer cannot express it>`",
        );
      }
    }
  }

  const hookPath = join(ROOT, ".claude/hooks/bash-gate.js");
  const settingsPath = join(ROOT, ".claude/settings.json");
  if (!existsSync(hookPath) || !existsSync(settingsPath)) {
    fail(
      "hooks",
      ".claude/",
      "bash-gate.js or settings.json is missing",
      "the gate cannot be reconciled — restore the file or remove this check",
    );
    return;
  }

  const settings = JSON.parse(read(settingsPath));
  const gated = new Set([
    ...(settings.permissions?.deny ?? []),
    ...(settings.permissions?.ask ?? []),
  ]);

  // Raw source: the twins are declared in COMMENTS, so code() would erase them.
  // The same trap that kept the +02:00 check green for months.
  // Anchored to a DEDICATED comment line. The first version matched `@twin` anywhere
  // and swallowed a sentence of prose about the markers — "the @twin design below…" —
  // reported as a twin settings.json did not carry. A check matching its own
  // explanatory comment, in the check written to demonstrate that failure.
  const src = read(hookPath);
  const lines = src.split("\n");
  const twins = [];
  let unprobed = 0;

  for (let i = 0; i < lines.length; i++) {
    const t = /^\s*\/\/\s*@twin\s+(.+?)\s*$/.exec(lines[i]);
    if (!t) continue;
    twins.push(t[1]);

    // The rule body this twin covers: the code lines following it, to the end of the
    // array entry. Hashed together with the twin pattern so the probe record binds to
    // WHAT IT PROBED — "re-probe on any edit" is undetectable otherwise, because
    // nothing notices the edit. A dormant twin (see the hook header) cannot announce
    // its own rot in normal operation, so this is the only thing that will.
    const body = [];
    for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
      const line = lines[j].trim();
      if (line.startsWith("//")) continue;
      body.push(line);
      if (line.endsWith("],")) break;
    }
    const sha = createHash("sha1").update(t[1] + "\n" + body.join("\n")).digest("hex").slice(0, 6);

    // The probe record sits in the comment block belonging to THIS twin — and the block
    // must stop at the next one. A fixed five-line window reached past the entry into the
    // following `// @twin`, so a twin whose own record was deleted borrowed its
    // neighbour's and passed. Found on 2026-08-19 by deleting a real record and watching
    // nothing happen; reading the check had not found it, and neither had the structural
    // checks around it. That is L-03 exactly — an aperture that lets one item see the
    // next item's marker — in the check written to reconcile the fallback layer.
    const blockLines = [];
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      if (/@twin\s/.test(lines[j])) break;
      blockLines.push(lines[j]);
    }
    const block = blockLines.join("\n");
    const probed = /@probed\s+(never|(\d{4}-\d{2}-\d{2})\s+hook-disabled:\s*\S+)/.exec(block);

    if (!probed) {
      fail(
        "hooks",
        `${rel(hookPath)}:${i + 1}`,
        `twin \`${t[1]}\` has no @probed record`,
        "add `// @probed never — …`, or probe it with the hook disabled and record the date + sha",
      );
      continue;
    }
    if (probed[1] === "never") {
      unprobed++;
      continue;
    }

    const recorded = /@probed-sha\s+([0-9a-f]{6})/.exec(block);
    if (!recorded) {
      fail(
        "hooks",
        `${rel(hookPath)}:${i + 1}`,
        `twin \`${t[1]}\` claims a probe but records no sha, so nothing detects a later edit`,
        `add \`// @probed-sha ${sha}\``,
      );
    } else if (recorded[1] !== sha) {
      fail(
        "hooks",
        `${rel(hookPath)}:${i + 1}`,
        `twin \`${t[1]}\` was edited since its last interception probe (recorded ${recorded[1]}, now ${sha})`,
        "re-probe with the hook disabled, then update the date and sha",
      );
    }
  }

  // Reported, not failed. An unprobed twin is an unverified control, not a broken one,
  // and blocking the build on it would just get the records written without the probe.
  // Same shape as the unenforceable count: visible, and it should only fall.
  if (unprobed) console.log(`      ↳ ${unprobed} of ${twins.length} twins unprobed`);

  if (twins.length === 0) {
    fail(
      "hooks",
      ".claude/hooks/bash-gate.js",
      "declares no @twin at all — either the markers were dropped or this check is scanning the wrong file",
      "every DENY/ASK entry carries a `// @twin <settings pattern>` line",
    );
    return;
  }

  for (const twin of twins) {
    if (!gated.has(twin)) {
      fail(
        "hooks",
        ".claude/settings.json",
        `bash-gate declares a twin \`${twin}\` that settings.json does not carry`,
        "add it to permissions.ask — the twin only matters when the hook is dead, so ask is the floor",
      );
    }
  }

  // The reverse direction: a gate with no twin declared at all. Counts the rule
  // entries structurally rather than trusting the marker count.
  const ruleLines = [...src.matchAll(/^\s*\[\s*(?:cmdRe|\/)/gm)].length;
  if (twins.length < ruleLines) {
    fail(
      "hooks",
      ".claude/hooks/bash-gate.js",
      `${ruleLines} gate rules but only ${twins.length} @twin declarations`,
      "every gate names its settings twin, or is annotated as deliberately hook-only",
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. THE RULES THAT USED TO BE HELD BY ATTENTION ALONE
//
// Each of these was an UNENFORCEABLE bullet in CLAUDE.md — a rule with no net,
// held only by whoever was paying attention. Each is now mechanised as far as it
// honestly can be, which for two of them means "the exceptions are a decision
// log" rather than "the pattern is banned".
//
// Every allowlist entry below asserts its own premise: if the site it exempts
// stops existing, the entry fails rather than silently covering whatever is
// written into that file next.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Models whose rows are irreplaceable: money, sessions, and people. Deleting one
 * destroys a record of something that actually happened.
 *
 * NOT listed: CMS and catalogue models (pages, courses, modules, lectures,
 * quizzes, coupons, campaigns, testimonials, packages, digital products, drip
 * emails, availability overrides, billing presets). Removing those is ordinary
 * admin work — treating them the same would make this check noise, and noise is
 * how a scanner gets waved through.
 */
const PROTECTED_MODELS = [
  "booking", "student", "invoice", "paymentRequest", "sessionCreditBalance",
  "sessionCreditTransaction", "auditLog", "authEvent", "order", "orderItem", "adminUser",
];

/** Deliberate hard deletes. Each is a decision, with the reason it was made. */
const HARD_DELETE_ALLOWED = [
  {
    file: "app/(admin)/admin/(dashboard)/bookings/actions.ts",
    model: "booking",
    why: "the admin Delete Booking action. A booking created in error has no soft-delete state that " +
         "makes sense — a cancelled booking is a real event that happened, a mistyped one is not. " +
         "Audited before the row goes (booking_deleted), which is the substitute for keeping it.",
  },
  {
    file: "app/(admin)/admin/(dashboard)/users/actions.ts",
    model: "adminUser",
    why: "removing an admin's access. The AuthEvent trail survives the row, so the history of what " +
         "they did is not lost with them.",
  },
];

check("data-safety: an irreplaceable record is never hard-deleted", () => {
  const seen = new Set();
  for (const file of allSource().filter((f) => f.endsWith(".ts"))) {
    const src = code(read(file));
    for (const m of src.matchAll(/prisma\.(\w+)\.delete(?:Many)?\(/g)) {
      if (!PROTECTED_MODELS.includes(m[1])) continue;
      const relf = rel(file);
      const allowed = HARD_DELETE_ALLOWED.find((a) => a.file === relf && a.model === m[1]);
      if (allowed) {
        seen.add(`${allowed.file}|${allowed.model}`);
        continue;
      }
      fail(
        "data-safety",
        `${relf}:${src.slice(0, m.index).split("\n").length}`,
        `hard-deletes \`${m[1]}\`, an irreplaceable record`,
        "soft-delete instead (status flag, isActive:false, archivedAt) — or add a HARD_DELETE_ALLOWED entry saying why this one is different",
      );
    }
  }
  for (const a of HARD_DELETE_ALLOWED) {
    if (!seen.has(`${a.file}|${a.model}`)) {
      fail(
        "data-safety",
        a.file,
        `HARD_DELETE_ALLOWED exempts \`${a.model}\` here, but no such delete exists any more`,
        "remove the entry — a stale exemption reads as a considered decision and covers whatever is written next",
      );
    }
  }
});

/**
 * The audit-worthy list, verbatim from CLAUDE.md: billing type changes, booking
 * cancellations, payment recording, invoice voiding, client status changes,
 * discount changes. Nothing can infer that list — it is a business judgement — so
 * it is written down, and this check holds the codebase to it.
 */
const AUDIT_WORTHY = /^(void|cancel|recordPayment|changeBillingType|excludeFromBilling|applyDiscount|setDiscount|deactivate|archive)\w*/;

/**
 * Audit-worthy by NAME but not by nature, or audited by a delegate. Each entry says
 * which, because they are different claims and only one of them can go stale quietly.
 */
const AUDIT_EXEMPT = [
  {
    fn: "cancelBookingFromBillingAction",
    why: "a thin wrapper that calls updateBookingStatus(id, 'cancelled'), which records " +
         "booking_status_cancelled. Auditing here too would write the row twice.",
  },
  {
    fn: "cancelScheduleAction",
    why: "cancels a campaign SEND SCHEDULE, not a client or money record — outside the " +
         "audit-worthy list, which is about billing, bookings and client status.",
  },
  {
    fn: "cancelInviteAction",
    why: "a CLIENT withdrawing a partner invitation from their own portal. Outside the list " +
         "for the same reason: no money, no booking, no status change to their account. The " +
         "audit trail is for admin actions on a client's record, not a client's on their own.",
  },
];

check("audit-trail: an audit-worthy action records one", () => {
  const seen = new Set();
  for (const file of allSource().filter((f) => f.endsWith("actions.ts"))) {
    const src = read(file);
    for (const part of src.split(/\n(?=export async function )/)) {
      const fn = /export async function (\w+)/.exec(part)?.[1];
      if (!fn || !AUDIT_WORTHY.test(fn)) continue;

      const delegated = AUDIT_EXEMPT.find((d) => d.fn === fn);
      if (delegated) {
        seen.add(fn);
        continue;
      }
      // code(), so a mention of recordAudit in a comment cannot stand in for calling it.
      if (/recordAudit\s*\(/.test(code(part))) continue;

      fail(
        "audit-trail",
        `${rel(file)} → ${fn}`,
        "is audit-worthy by name but records no audit entry",
        "call recordAudit() — or add an AUDIT_EXEMPT entry naming why this one is outside the list, or where its entry is written",
      );
    }
  }
  for (const d of AUDIT_EXEMPT) {
    if (!seen.has(d.fn)) {
      fail(
        "audit-trail",
        "scripts/architecture-audit.mjs",
        `AUDIT_EXEMPT names \`${d.fn}\`, which no longer exists`,
        "remove the entry",
      );
    }
  }
});

/**
 * Side effects that leave the building: an email, a PDF, a payment link. The rule
 * is that these happen when the user clicks Send — not when they click Save.
 */
const REACHES_OUTSIDE =
  /\bsendEmail\s*\(|\bsendInvoiceEmail\s*\(|\bsendPaymentRequestEmail\s*\(|\bgenerateAndStoreInvoicePDF\s*\(|\binitializeTransaction\s*\(/;

const SAVE_SIDE_EFFECT_ALLOWED = [
  {
    fn: "updateBookingStatus",
    why: "the send is gated on status === 'cancelled'. Cancelling a session and telling the client " +
         "are one act, not a save that quietly emails — the client learning about it later, from " +
         "an empty calendar, is the worse outcome.",
  },
  {
    fn: "updatePaymentRequestAction",
    why: "regenerates the Paystack link because the AMOUNT changed. Leaving the old link live would " +
         "let a client pay a figure the request no longer says. It creates a link; it does not send one.",
  },
];

check("side-effects: a save action does not reach the outside world", () => {
  const seen = new Set();
  for (const file of allSource().filter((f) => f.endsWith("actions.ts"))) {
    const src = read(file);
    for (const part of src.split(/\n(?=export async function )/)) {
      const fn = /export async function (\w+)/.exec(part)?.[1];
      if (!fn || !/^(save|update|edit)[A-Z]/.test(fn)) continue;

      const allowed = SAVE_SIDE_EFFECT_ALLOWED.find((a) => a.fn === fn);
      const m = code(part).match(REACHES_OUTSIDE);
      if (allowed) {
        if (m) seen.add(fn);
        continue;
      }
      if (!m) continue;

      fail(
        "side-effects",
        `${rel(file)} → ${fn}`,
        `a save-named action calls ${m[0].trim()} — an email, PDF or payment link fired by "Save"`,
        'move it behind an explicit Send action, or add a SAVE_SIDE_EFFECT_ALLOWED entry saying why saving and sending are one act here',
      );
    }
  }
  for (const a of SAVE_SIDE_EFFECT_ALLOWED) {
    if (!seen.has(a.fn)) {
      fail(
        "side-effects",
        "scripts/architecture-audit.mjs",
        `SAVE_SIDE_EFFECT_ALLOWED exempts \`${a.fn}\`, which no longer has a side effect`,
        "remove the entry",
      );
    }
  }
});

check("confirm-dialogs: a confirm action is not nested inside the dialog it closes", () => {
  // Radix's AlertDialogAction closes the dialog on click, which unmounts
  // AlertDialogContent. A <form> rendered inside that content is unmounted with
  // it, and the submission never completes — so the dialog states exactly what it
  // is about to do, and then does nothing.
  //
  // Found in production on all four delete dialogs at once (bookings, courses,
  // testimonials, users). It survived because the failure is INVISIBLE: no error,
  // no toast, no log line. The tell was in the database — zero booking_deleted
  // audit rows, on an action that writes one before it deletes.
  //
  // Worth flagging as a class rather than a Radix quirk: a control that both
  // dismisses a surface and submits from within it is racing its own teardown.
  for (const file of allSource().filter((f) => f.endsWith(".tsx"))) {
    const src = code(read(file));
    for (const m of src.matchAll(/<form[^>]*\baction=\{[\s\S]{0,200}?<AlertDialogAction/g)) {
      fail(
        "confirm-dialogs",
        `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
        "AlertDialogAction submits a form nested in the dialog it dismisses — the form unmounts before the action runs",
        "use a plain <Button type=\"submit\">; let the action's redirect close the dialog",
      );
    }
  }
});

/**
 * Every check below walks the tree. If a walk returns nothing — a moved directory,
 * a renamed group, a glob that decayed — every one of them passes, in silence, and
 * the run reports green. That is worse than having no checks, because it actively
 * reports safety.
 *
 * The floor is REALISTIC, not `> 0`: `> 0` still passes when an enumeration decays
 * from 622 files to one. Set well below today's count so ordinary deletion doesn't
 * trip it, and well above the decay modes that matter.
 */
const SOURCE_FLOOR = 400;

check("audit: the source enumeration has not decayed", () => {
  const n = allSource().length;
  if (n < SOURCE_FLOOR) {
    fail(
      "audit",
      "scripts/architecture-audit.mjs",
      `the tree walk found ${n} files, below the floor of ${SOURCE_FLOOR} — every other check is scanning almost nothing and passing`,
      "check APP/LIB/COMPONENTS still resolve and the extension filter still matches; raise the floor deliberately if the tree really shrank",
    );
  }
});

/**
 * Namespaces a marker may claim, and how each is resolved. `audit:` is checked
 * against real check names below; the rest need their own source of truth, because
 * a tag that resolves to nothing is worse than a missing tag — it passes the "is it
 * tagged" test, registers no claim, and is counted as enforced.
 */
const MARKER_NAMESPACES = ["audit", "eslint", "hook", "settings", "test"];

/** `settings:<slug>` → the permission entry it claims. The entry must exist. */
const SETTINGS_TAGS = {
  "ask-git-push": "Bash(git push*)",
};

/**
 * `eslint:<rule>` cannot be resolved statically: the rules that matter here arrive
 * from presets (`eslint-config-next`, the TypeScript plugin) and never appear in
 * eslint.config.mjs. So the tag carries a PROBE RECORD instead, the same shape the
 * settings twins use — a manual verification, recorded, rather than an inferred one.
 */
const ESLINT_TAGS_PROBED = {
  "@typescript-eslint/no-explicit-any":
    "probed 2026-08-18, hook irrelevant: wrote a file containing `const x: any = 1`, ran eslint on " +
    "it, got `Unexpected any. Specify a different type`. Preset-provided rules are invisible to a " +
    "static read of the config, so this record IS the verification.",
};

/**
 * Duplicated implementations, carried as debt. The list only SHRINKS — an entry leaves
 * when the copies are collapsed into one, and any NEW duplication fails the build.
 *
 * Keyed on the site list rather than the body hash on purpose: if someone edits one copy
 * the hash moves and it reports as new, which is right — copies that have DIVERGED are
 * worse than copies that agree, because now two behaviours wear one name.
 */
const DUPLICATE_BODIES_KNOWN = [
  // COLLAPSED 2026-08-19. `replacePlaceholders` stood in five identical copies — here
  // and in four senders — which is exactly how escaping reached one caller and not the
  // others. Now exported once from lib/email-render.ts. Left as a note rather than
  // deleted silently: the entry it replaces was the documented scar, and its absence
  // should read as resolved rather than as never-recorded.
  //
  // Time arithmetic in three places, one under a different name. This codebase's scars
  // are disproportionately date/time, so these belong in lib/dates.ts.
  "app/(portal)/portal/(dashboard)/book/actions.ts → formatMinutesToTime | app/(public)/book/actions.ts → formatMinutesToTime | lib/availability.ts → formatTime",
  "app/(admin)/admin/(dashboard)/bookings/day-view.tsx → timeToMinutes | app/(admin)/admin/(dashboard)/bookings/week-view.tsx → timeToMinutes",
  // COLLAPSED 2026-08-19. `handleSignOut` was filed here as UI tidying and reclassified
  // on reading it: the bodies are session teardown, clearing the chunked `sb-*` cookies
  // Supabase leaves behind, where a stale fragment reads as a partly-valid session. Two
  // copies meant a fix to that reached one surface. Now lib/auth/sign-out.ts.
  //
  // The rest were each opened and given their own verdict rather than judged by name
  // (dev-standards/LESSONS.md L-27). They are NOT one undifferentiated pile:
  //
  // Pure formatters — no state, no security surface. Real duplication, and a divergence
  // costs a differently-rounded file size or a differently-derived slug: visible at once
  // and harmful to nobody. Genuinely the back of the queue.
  "components/admin/lecture-form.tsx → formatBytes | components/admin/preview-video-upload.tsx → formatBytes",
  "components/admin/course-form.tsx → handleTitleChange | components/admin/digital-product-form.tsx → handleTitleChange | components/admin/package-form.tsx → handleTitleChange",
  // Upload handlers, identical TODAY and expected to diverge: an image dropzone wants
  // dimension and MIME validation a generic file dropzone must not impose. Collapsing
  // them would build a shared function with two callers pulling opposite ways, which is
  // worse than the copy. Kept deliberately — this is a decision, not a backlog item.
  "components/admin/file-upload.tsx → handleDrop | components/admin/image-upload.tsx → handleDrop",
  "components/admin/file-upload.tsx → handleFileSelect | components/admin/image-upload.tsx → handleFileSelect",
  // A blank line-item factory shared by the two dialogs that build invoice lines. Small,
  // but it encodes the SHAPE of a LineItem — add a field to the type and one dialog
  // starts producing rows without it. Belongs in lib/billing-types.ts, which already owns
  // the type. Queued rather than urgent: a missing field is a type error, not a silent
  // one, which is what separates this from the sign-out case above.
  "app/(admin)/admin/(dashboard)/clients/[id]/tabs/payment-request-dialogs.tsx → emptyLine | app/(admin)/admin/(dashboard)/invoices/new-pr-dialog.tsx → emptyLine",
];

check("duplication: one implementation, not several", () => {
  // M-04, and the half of "never create parallel systems" that can actually be decided.
  //
  // "Is this a duplicate SYSTEM" is a judgement about intent. Duplicate IMPLEMENTATION
  // is a fact about bytes, and it is what this codebase has repeatedly paid for: five
  // copies of the placeholder substituter with escaping on one, two byte-identical CSV
  // escapers with formula injection on neither, two partner lookups reading opposite
  // ends of the same row.
  //
  // A NAME registry would have caught none of those — every pair used different names.
  // Hashing the normalised body catches them regardless of what they are called, which
  // is the whole point.
  //
  // STATED LIMIT: exact bodies only. The fifth `replacePlaceholders` copy differs from
  // the other four by `.replace` vs `.replaceAll` — functionally identical on a global
  // regex — and is therefore invisible here. Near-duplicates need a reader, and the
  // number this check reports is a floor, not a census.
  const normalise = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1").replace(/\s+/g, " ").trim();

  const MIN_BODY = 60; // below this, two functions agreeing is coincidence
  const byHash = new Map();

  for (const file of allSource().filter((f) => /\.tsx?$/.test(f))) {
    const src = read(file);
    const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*\{|(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?\([^)]*\)(?:\s*:\s*[^=]+)?\s*=>\s*\{/g;
    let m;
    while ((m = re.exec(src))) {
      const name = m[1] ?? m[2];
      const open = src.indexOf("{", m.index + m[0].length - 1);
      if (open === -1) continue;
      let depth = 0, end = -1;
      for (let j = open; j < src.length; j++) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") { depth--; if (depth === 0) { end = j; break; } }
      }
      if (end === -1) continue;
      const body = normalise(src.slice(open + 1, end));
      if (body.length < MIN_BODY) continue;
      const h = createHash("sha1").update(body).digest("hex");
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h).push(`${rel(file)} → ${name}`);
    }
  }

  const seen = new Set();
  for (const sites of byHash.values()) {
    if (new Set(sites.map((s) => s.split(" → ")[0])).size < 2) continue;
    const key = [...sites].sort().join(" | ");
    if (DUPLICATE_BODIES_KNOWN.includes(key)) { seen.add(key); continue; }
    fail(
      "duplication",
      sites[0].split(" → ")[0],
      `this function body appears in ${sites.length} places: ${sites.join(", ")}`,
      "collapse them into one implementation and import it — or add the site list to DUPLICATE_BODIES_KNOWN with the reason it must stay",
    );
  }
  for (const key of DUPLICATE_BODIES_KNOWN) {
    if (!seen.has(key)) {
      fail(
        "duplication",
        "scripts/architecture-audit.mjs",
        `DUPLICATE_BODIES_KNOWN carries an entry that no longer duplicates: ${key.slice(0, 90)}…`,
        "delete the entry — the list only shrinks, and a stale one is indistinguishable from live debt",
      );
    }
  }
  console.log(`      ↳ ${DUPLICATE_BODIES_KNOWN.length} duplicated implementations carried as debt`);
});

check("mechanisable: every unenforceable rule has a queue entry, and vice versa", () => {
  // The register is a BUILD QUEUE and only shrinks — an entry leaves when its mechanism
  // ships and the rule swaps UNENFORCEABLE for @enforced. Two ways that goes wrong and
  // both are silent: a new unenforceable rule with no entry (added without anyone asking
  // what a mechanism would assert), and an entry whose rule is gone (a queue item for
  // work nobody needs, indistinguishable from one that matters).
  //
  // Set difference, not classification — the same shape as the marker and twin checks.
  const md = read(join(ROOT, "CLAUDE.md"));
  const regPath = join(ROOT, "docs/MECHANISABLE.md");
  if (!existsSync(regPath)) {
    fail("mechanisable", "docs/MECHANISABLE.md", "the register named by §5 does not exist",
      "create it, or drop the pointers");
    return;
  }
  const reg = read(regPath);

  // RAW source both sides: the pointers and the headings are literal text.
  const pointed = new Set([...md.matchAll(/→\s*(M-\d+)/g)].map((m) => m[1]));
  const defined = new Set([...reg.matchAll(/^###\s+(M-\d+)\s+—/gm)].map((m) => m[1]));

  for (const id of pointed) {
    if (!defined.has(id)) {
      fail("mechanisable", "CLAUDE.md", `§5 points at \`${id}\`, which the register does not define`,
        "add the entry, or correct the pointer");
    }
  }
  for (const id of defined) {
    if (!pointed.has(id)) {
      fail("mechanisable", "docs/MECHANISABLE.md", `\`${id}\` is queued but no rule points at it`,
        "the rule was mechanised or removed — delete the entry; the queue only shrinks");
    }
  }

  // Every unenforceable rule must be queued. A rule with no entry is one nobody has
  // asked "what would a mechanism assert" about.
  const lines = md.split("\n");
  let inFive = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,3} /.test(lines[i])) inFive = lines[i].trim() === "## 5 · DOCTRINE THE MACHINE CANNOT HOLD";
    if (!inFive || !/^- \*\*/.test(lines[i])) continue;
    let body = lines[i];
    for (let j = i + 1; j < lines.length && !/^[-#]/.test(lines[j]); j++) body += " " + lines[j];
    if (!/\bUNENFORCEABLE\b/.test(body)) continue;
    if (/→\s*M-\d+/.test(body)) continue;
    fail("mechanisable", `CLAUDE.md:${i + 1}`,
      "an unenforceable rule with no build-queue entry",
      "add an entry to docs/MECHANISABLE.md and point at it with `→ M-0N` — a sketch, or the measurement saying why none is worth building");
  }
});

/**
 * `toLocale*` sites that are genuinely safe, each classified against the value it
 * formats — NOT baselined from a first run. Three of the four were resolved by opening
 * the file and asking what the date IS, which is the difference between a debt record
 * and a record of the author's ignorance (`dev-standards/LESSONS.md` L-27).
 */
const LOCALE_FORMAT_ALLOWED = [
  {
    at: "app/(admin)/admin/(dashboard)/bookings/series-timeline.tsx",
    why: "formats `booking.date`, a @db.Date stored at UTC midnight. Midnight UTC renders as the same calendar day in UTC and in SAST (UTC+2), so the runtime zone cannot shift it here. Would break in a negative-offset zone; Vercel is UTC.",
  },
  {
    at: "app/(admin)/admin/(dashboard)/page.tsx",
    why: "two sites: a `{month: 'short'}` label on `now`, and `nextSession.date` which is a @db.Date. The month label is wrong only in the last two hours of a month, on a dashboard heading — noted, not worth the churn.",
  },
  {
    at: "app/(admin)/admin/(dashboard)/invoices/page.tsx",
    why: "formats `new Date('YYYY-MM-01')` for a billing-month label. Month and year only, from a constructed first-of-month — no instant involved.",
  },
  {
    at: "components/ui/calendar.tsx",
    why: "vendored shadcn. Writes a `data-day` ATTRIBUTE, not display text, and the file is regenerated by `npx shadcn add`.",
  },
];

check("date-safety: display formatting resolves in SAST", () => {
  // The date-safety family caught `.toISOString().slice(0,10)`, `format()`,
  // `new Date(y,m,d)` and a literal `+02:00` — and not this spelling, which is how four
  // real instants were rendered in the SERVER's zone. `toLocaleDateString` without a
  // `timeZone` option formats in the runtime's zone, UTC on Vercel, so an invoice created
  // at 00:30 SAST displayed and EXPORTED under the previous day. Every night, 22:00 to
  // midnight — the turnover this project's oldest scar is about.
  //
  // Found by classifying a duplication finding rather than accepting its count: two
  // copies of `formatDate` were flagged as debt, and reading them showed the duplication
  // was the smaller half of the problem.
  //
  // RAW source: `toLocaleDateString` is a member access, not a literal, but the allowlist
  // reasons quote it in prose — and a comment explaining the rule must not read as a
  // violation of it, so comments are stripped for the match.
  for (const file of allSource().filter((f) => /\.tsx?$/.test(f))) {
    if (rel(file) === "lib/dates.ts") continue; // the SSOT, which passes an explicit zone
    const allowed = LOCALE_FORMAT_ALLOWED.find((a) => a.at === rel(file));
    const src = codeKeepingLiterals(read(file));
    for (const m of src.matchAll(/\.toLocale(?:Date|Time)String\s*\(/g)) {
      if (allowed) continue;
      fail(
        "date-safety",
        `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
        "formats a date in the runtime's timezone — UTC on Vercel, not SAST",
        "use saFormat(date, pattern) from lib/dates.ts — or add a LOCALE_FORMAT_ALLOWED entry saying which value it formats and why the zone cannot shift it",
      );
    }
  }
  // An exemption that stops exempting is a stale decision covering whatever is written
  // into that file next.
  for (const a of LOCALE_FORMAT_ALLOWED) {
    const abs = join(ROOT, a.at);
    if (!existsSync(abs)) {
      fail("date-safety", a.at, "LOCALE_FORMAT_ALLOWED names a file that no longer exists", "remove the entry");
    } else if (!/\.toLocale(?:Date|Time)String\s*\(/.test(codeKeepingLiterals(read(abs)))) {
      fail("date-safety", a.at, "is exempted from the locale-formatting rule but no longer formats one", "remove the entry");
    }
  }
});

check("csv: every export goes through the one escaper", () => {
  // Adopted from a sibling project's `check-csv-escaping`, which states the rule as
  // "every CSV we EMIT must go through the one escaper" — and the reason to take it
  // rather than reinvent it is that this codebase had exactly the failure it prevents.
  //
  // Two escapers existed, in the reports actions and the invoice export, with
  // byte-identical bodies. Both handled RFC 4180 quoting. NEITHER handled formula
  // injection, so the duplication was not the bug — it was the reason one fix would
  // have reached half the exports.
  //
  // The risk is the direction: client-supplied strings (their name, the billing name
  // and email they typed, an EFT reference they chose) land in a spreadsheet on an
  // admin's machine, where a cell beginning `=`, `+`, `@` or a tab is EXECUTED.
  const LOCAL_ESCAPER = /(?:const|function)\s+\w*[eE]scape\w*\s*[=(][\s\S]{0,200}?replace\(\s*\/"\/g/;
  const RAW_JOIN = /\.join\(\s*","\s*\)/;

  // RAW source, not code(). Both patterns hunt for STRING LITERALS — `.join(",")` and
  // the quote inside an escaper — and code() blanks those, turning `.join(",")` into
  // `.join("")`. The first version of this check scanned code() and could not fire.
  //
  // That is the FIFTH time in one session, and the repetition is the finding: the
  // helper is named `code()`, which reads as "the code" when it means "the code minus
  // its string literals". Any check hunting a literal must read raw, and the name does
  // not warn you. Worth renaming it, or making the selftest fixture louder.
  for (const file of allSource().filter((f) => /\.tsx?$/.test(f))) {
    if (rel(file) === "lib/csv.ts") continue; // the one escaper
    const src = read(file);
    if (!/csv/i.test(src)) continue; // only files that actually emit CSV

    if (LOCAL_ESCAPER.test(src)) {
      fail(
        "csv",
        `${rel(file)}:${src.slice(0, LOCAL_ESCAPER.exec(src).index).split("\n").length}`,
        "defines its own CSV escaper",
        "use csvCell/csvRow/csvDocument from lib/csv.ts — a local copy will miss formula injection, as both previous copies did",
      );
    }
    // A row assembled by joining on a comma, in a CSV-emitting file, is a row that
    // skipped the escaper.
    for (const m of src.matchAll(new RegExp(RAW_JOIN.source, "g"))) {
      const line = src.slice(0, m.index).split("\n").length;
      const context = src.split("\n")[line - 1] ?? "";
      if (/csvRow|csvDocument|csvCell/.test(context)) continue;
      if (!/row|header|csv/i.test(context)) continue;
      fail(
        "csv",
        `${rel(file)}:${line}`,
        "builds a CSV row by joining on a comma instead of using the escaper",
        "use csvRow() / csvDocument() from lib/csv.ts",
      );
    }
  }
});

check("relationships: a partner lookup reads both ends of the row", () => {
  // A ClientRelationship row is DIRECTIONAL and is never written reciprocally —
  // measured 2026-08-19: nine rows, nine distinct pairs, zero stored both ways. So a
  // query filtering on `studentId` alone finds the partner only when the client happens
  // to be the side the row was entered from. It is a coin flip, which is why the miss
  // looked random rather than like a bug.
  //
  // Two of four readers had it right (an OR across both columns) and two did not — one
  // of them added the same morning a lesson was written about defences that reach some
  // of their sites. The lookup now lives in lib/partner-link.ts.
  for (const file of allSource().filter((f) => /\.tsx?$/.test(f))) {
    if (rel(file) === "lib/partner-link.ts") continue; // the one that does it correctly
    const src = code(read(file));
    for (const m of src.matchAll(/clientRelationship\.\w+\(\{[\s\S]{0,400}?\}\)/g)) {
      const q = m[0];
      if (!/relationshipType:\s*""|partner/i.test(q) && !/relationshipType/.test(q)) continue;
      // Reading both columns, or pinning a specific pair, or fetching by row id: fine.
      if (/relatedStudentId/.test(q) || /\bid:\s/.test(q)) continue;
      if (!/studentId/.test(q)) continue;
      fail(
        "relationships",
        `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
        "queries a relationship by studentId only — rows are directional, so this sees the link from one side",
        "use findPartnerOf()/findPartnerName() from lib/partner-link.ts, or OR across studentId and relatedStudentId",
      );
    }
  }
});

check("citations: a lesson reference names the ledger that holds it", () => {
  // The ledger lives in dev-standards, in its own repo, and IDs there are two digits.
  // This project's docs/LESSONS.md is a POINTER with no numbered entries at all.
  //
  // On 2026-08-19 four citations were written as `docs/LESSONS.md L-21` and `L-22` —
  // IDs that exist only in the shared ledger and never existed here. Each pointed at
  // nothing while reading as diligence, which is the class the shared L-07 describes,
  // and one of them sat in the header of the file whose existence it was justifying.
  //
  // Cannot resolve the target: it is another repository, on a path that varies per
  // machine. What it CAN do is catch the two shapes that were actually wrong — naming
  // the local pointer with an ID, and using this project's retired three-digit
  // numbering. Both are format errors, so both are decidable from here.
  const files = [
    ...allSource().filter((f) => /\.(ts|tsx|mjs)$/.test(f)),
    join(ROOT, "CLAUDE.md"),
    ...walk(join(ROOT, "scripts"), /\.mjs$/),
  ];

  // Two files are excluded, and the second is the interesting one.
  //
  // Citations live in COMMENTS by nature, so this check cannot strip them the way the
  // marker checks do — which means a file that DOCUMENTS the bad shape is
  // indistinguishable from one that commits it. This script quotes both wrong forms
  // above as examples, and the first run duly flagged its own explanation. That is the
  // fourth time today a check has matched its own documentation; the difference here is
  // that the usual fix (strip comments) would remove the thing being hunted.
  const DOCUMENTS_THE_SHAPES = new Set([
    "docs/LESSONS.md", // the pointer file, which explains the retired numbering
    "scripts/architecture-audit.mjs", // this check's own prose
  ]);

  for (const file of [...new Set(files)]) {
    if (!existsSync(file)) continue;
    if (DOCUMENTS_THE_SHAPES.has(rel(file))) continue;
    const src = read(file);

    for (const m of src.matchAll(/docs\/LESSONS\.md`?\s+L-(\d+)/g)) {
      fail(
        "citations",
        `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
        `cites \`docs/LESSONS.md L-${m[1]}\`, but that file is a pointer with no numbered entries`,
        "cite `dev-standards/LESSONS.md L-nn` — the ledger that actually holds the entry",
      );
    }
    for (const m of src.matchAll(/dev-standards\/LESSONS\.md`?\s+L-(\d{3,})/g)) {
      fail(
        "citations",
        `${rel(file)}:${src.slice(0, m.index).split("\n").length}`,
        `cites \`L-${m[1]}\` — three-digit IDs were this project's retired local numbering`,
        "the shared ledger uses two digits (L-01 … L-24); check which entry you mean",
      );
    }
  }
});

check("audit: a check that says it scans raw actually scans raw", () => {
  // L-33: a normaliser can delete the evidence. `code()` blanks string literals, so a
  // check hunting a value that only ever appears inside quotes cannot fire — it reports
  // zero, and zero from a rule-checker reads as a clean tree. The `+02:00` check shipped
  // exactly that way and was green for months.
  //
  // Surveyed 2026-08-19: thirteen checks here declare the raw/literal choice load-bearing
  // in their comments, and NONE of them was blind — the discipline is already applied per
  // check. So the exposure is not today's behaviour, it is the silent revert: someone
  // tidies `read(f)` into `code(read(f))`, the check keeps running, and it stops firing.
  //
  // This reconciles the CLAIM against the CODE. A comment saying "raw source, not code()"
  // is a promise; this asserts the file read still keeps its literals. It cannot catch
  // someone who deletes the comment too — but that is a deliberate act against a stated
  // reason, not the tidy-up this exists to stop. Stated rather than hidden, because a
  // check whose limit is unwritten gets trusted past it.
  const src = read(join(ROOT, "scripts/architecture-audit.mjs"));
  const starts = [...src.matchAll(/^check\("([^"]+)"/gm)].map((m) => ({ name: m[1], index: m.index }));

  // Excluded by name: this check's own prose necessarily contains the phrases it hunts,
  // which is the L-05 shape — a metric whose vocabulary appears in the corpus it measures.
  const SELF = "audit: a check that says it scans raw actually scans raw";
  const CLAIMS_RAW = /RAW source|raw source, not code|not code\(\)/i;

  for (let i = 0; i < starts.length; i++) {
    const name = starts[i].name;
    if (name === SELF) continue;
    const body = src.slice(starts[i].index, i + 1 < starts.length ? starts[i + 1].index : src.length);
    if (!CLAIMS_RAW.test(body)) continue;

    // A literal-preserving read is any `read(` not immediately wrapped in `code(`.
    // `codeKeepingLiterals(read(…))` counts: it strips comments and keeps the quotes,
    // which is the whole point of its existence.
    const reads = (body.match(/\bread\(/g) || []).length;
    const blanked = (body.match(/\bcode\(\s*read\(/g) || []).length;
    if (reads - blanked > 0) continue;

    fail(
      "audit",
      `scripts/architecture-audit.mjs:${src.slice(0, starts[i].index).split("\n").length}`,
      `"${name}" says it scans raw source, but every read it makes is wrapped in code()`,
      "code() blanks string literals — restore the raw read, or delete the claim if the target is no longer a literal",
    );
  }
});

check("claude-md: every marker binds to a bullet", () => {
  // The inverse of "every rule carries its net", and the half nobody writes. That check
  // asks whether each BULLET has a marker; this asks whether each MARKER has a bullet.
  // A marker floating after a prose paragraph claims enforcement for no rule — it is
  // counted by neither check, so both pass and the section reports as audited.
  //
  // A restructure is exactly what produces one: text moves, the marker stays behind, and
  // nothing about the file looks wrong. CLAUDE.md was restructured to the v4.3 template
  // in this project, which is why the gap was worth probing rather than assuming.
  // Confirmed by planting a bullet-less marker: it passed both marker checks in silence
  // and did not move the unenforceable ratio either.
  // SCOPED to the rules sections, and the scope is the point. A direction's scope is its
  // GRAMMAR's scope: the bullets-only grammar belongs to `### Enforced` and §5, so this
  // takes exactly the scope of its counterpart, "every rule in a rules section carries
  // its net". Outside those sections a marker legitimately annotates a paragraph —
  // in `.claude/rules/*.md` the paragraph IS the rule — and demanding a bullet there is
  // imposing one file's grammar on another's, which is how a check earns an allowlist
  // instead of a fix. The first version of this check ran file-wide.
  const RULES_SECTIONS = ["### Enforced", "## 5 · DOCTRINE THE MACHINE CANNOT HOLD"];
  const src = read(join(ROOT, "CLAUDE.md"));
  const lines = src.split("\n");

  /** Line indices that sit inside a rules section. */
  const inRules = new Set();
  let active = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^#{2,3} /.test(lines[i])) active = RULES_SECTIONS.includes(lines[i].trim());
    if (active) inRules.add(i);
  }

  /** Walk back from a line to the bullet that owns it. Blank line or heading = none. */
  const ownedByBullet = (i) => {
    for (let j = i; j >= 0; j--) {
      const line = lines[j];
      if (/^\s*-\s+\S/.test(line)) return true; // a list bullet
      if (!line.trim() || /^#{1,6}\s/.test(line) || /^\|/.test(line)) return false;
    }
    return false;
  };

  // 1. Marker comments — a comment whose whole body is `@enforced` tags, the same scope
  //    the well-formedness check uses so the two cannot disagree about what a marker is.
  for (const c of src.matchAll(/<!--([\s\S]*?)-->/g)) {
    if (!/^\s*(?:@enforced\s+\S+\s*)+$/.test(c[1])) continue;
    const at = src.slice(0, c.index).split("\n").length;
    if (!inRules.has(at - 1)) continue; // elsewhere, a paragraph may legitimately be the rule
    if (!ownedByBullet(at - 1)) {
      fail(
        "claude-md",
        `CLAUDE.md:${at}`,
        "an @enforced marker is not attached to any rule bullet",
        "move it onto the rule it enforces, or delete it — a marker claiming enforcement for nothing reads as coverage",
      );
    }
  }

  // 2. The visible token. Comments are stripped first, because the maintenance block at
  //    the top of the file explains the word and would otherwise be its own violation —
  //    the L-05 shape this file keeps meeting.
  const visible = src.replace(/<!--[\s\S]*?-->/g, (m) => "\n".repeat((m.match(/\n/g) || []).length));
  const visibleLines = visible.split("\n");
  for (let i = 0; i < visibleLines.length; i++) {
    if (!/\bUNENFORCEABLE\b/.test(visibleLines[i])) continue;
    if (!inRules.has(i)) continue; // same scope as its counterpart check
    if (!ownedByBullet(i)) {
      fail(
        "claude-md",
        `CLAUDE.md:${i + 1}`,
        "a visible UNENFORCEABLE is not attached to any rule bullet",
        "attach it to the rule it describes — a floating one is counted as neither enforced nor unenforceable",
      );
    }
  }
});

check("claude-md: every marker is well-formed and resolves", () => {
  // Scoped to HTML-comment syntax, so prose ABOUT the marker is not a false positive.
  // The header block discusses `@enforced <ns:control-id>` three times; a check that
  // matched the bare token would flag its own documentation (LESSONS L-05).
  const src = read(join(ROOT, "CLAUDE.md"));
  const auditSrc = read(join(ROOT, "scripts/architecture-audit.mjs"));
  const checks = [...auditSrc.matchAll(/check\("([^"]+)"/g)].map((m) => slug(m[1]));
  const settings = JSON.parse(read(join(ROOT, ".claude/settings.json")));
  const gated = new Set([
    ...(settings.permissions?.deny ?? []),
    ...(settings.permissions?.ask ?? []),
  ]);

  for (const c of src.matchAll(/<!--([\s\S]*?)-->/g)) {
    const body = c[1];
    if (!/@enforced/.test(body)) continue;

    // A MARKER is a comment whose entire body is markers. Comment syntax alone was
    // not a tight enough scope: the maintenance block at the top of CLAUDE.md is
    // itself an HTML comment, and it documents the format three times — so the first
    // version of this check flagged its own documentation, twice. That is L-05 again
    // (a metric whose vocabulary appears in the corpus it measures), and the fix is
    // the same shape as anchoring on the token instead of its neighbourhood.
    if (!/^\s*(?:@enforced\s+\S+\s*)+$/.test(body)) continue;

    const at = () => src.slice(0, c.index).split("\n").length;

    for (const t of body.matchAll(/@enforced(\S*)\s+(\S+)/g)) {
      // A malformed marker must fail LOUDLY, never parse to nothing.
      const m = /^([a-z]+):(.+)$/.exec(t[2]);
      if (t[1] || !m) {
        fail(
          "claude-md",
          `CLAUDE.md:${at()}`,
          `malformed marker \`@enforced${t[1]} ${t[2]}\` — it claims nothing, so the rule is counted as enforced while no control is named`,
          "use `@enforced <namespace>:<control-id>`",
        );
        continue;
      }
      const [, ns, id] = m;
      if (!MARKER_NAMESPACES.includes(ns)) {
        fail("claude-md", `CLAUDE.md:${at()}`, `unknown marker namespace \`${ns}:\``,
          `use one of: ${MARKER_NAMESPACES.join(", ")}`);
        continue;
      }
      if (ns === "audit") {
        if (!checks.some((k) => k === id || k.startsWith(id))) {
          fail("claude-md", `CLAUDE.md:${at()}`, `\`audit:${id}\` names no existing check`,
            "derive the id by slugifying the check name — never write it from memory");
        }
      } else if (ns === "hook") {
        if (!existsSync(join(ROOT, `.claude/hooks/${id}.js`))) {
          fail("claude-md", `CLAUDE.md:${at()}`, `\`hook:${id}\` names no file at .claude/hooks/${id}.js`,
            "point it at a hook that exists");
        }
      } else if (ns === "settings") {
        const claim = SETTINGS_TAGS[id];
        if (!claim) {
          fail("claude-md", `CLAUDE.md:${at()}`, `\`settings:${id}\` is not in SETTINGS_TAGS, so nothing resolves it`,
            "add it, naming the permission entry it claims");
        } else if (!gated.has(claim)) {
          fail("claude-md", `CLAUDE.md:${at()}`, `\`settings:${id}\` claims \`${claim}\`, which settings.json no longer carries`,
            "restore the entry, or retire the marker");
        }
      } else if (ns === "eslint") {
        if (!ESLINT_TAGS_PROBED[id]) {
          fail("claude-md", `CLAUDE.md:${at()}`, `\`eslint:${id}\` has no probe record`,
            "preset rules cannot be resolved statically — probe the rule once and record it in ESLINT_TAGS_PROBED");
        }
      }
    }
  }
});

check("claude-md: every rule in a rules section carries its net", () => {
  // Defines "rule" by LOCATION, not by content. Prose-parsing to decide what is a
  // rule was tried and produced a 100% false-positive rate on its first run; the
  // sections below are declared to hold rules and nothing else, so an untagged
  // bullet inside one is a forgotten tag by construction — no classification.
  //
  // Residue, stated because it cannot be closed: an incident-class rule written
  // into orientation or a scar narrative stays invisible to this check. Nothing
  // mechanical catches that. The ratchet pass asking "is this enforceable?" per
  // paragraph is a HUMAN control, and it is the only one there is.
  //
  // Raw source: the markers are HTML comments, and code() strips comments.
  const src = read(join(ROOT, "CLAUDE.md"));
  const lines = src.split("\n");

  // Sections DECLARED to hold rules and nothing else. §4's prose bullets live above
  // the "### Enforced" heading, so they are out of scope by construction rather than
  // by classification.
  const RULES_SECTIONS = ["### Enforced", "## 5 · DOCTRINE THE MACHINE CANNOT HOLD"];
  let inRules = false;
  let unenforceable = 0;
  let tagged = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{2,3} /.test(line)) inRules = RULES_SECTIONS.includes(line.trim());
    if (!inRules || !/^- \*\*/.test(line)) continue;

    // A rule may run onto continuation lines; its marker may sit on any of them.
    let body = line;
    for (let j = i + 1; j < lines.length && !/^[-#]/.test(lines[j]); j++) body += "\n" + lines[j];

    const hasEnforced = /@enforced\s+\w+:/.test(body);
    // Anchor on the TOKEN, never on its neighbourhood. An earlier version demanded a
    // space or dash after the word and false-positived on a rule that WAS tagged,
    // `(unchecked, and it is…)`. Same cause as three other false positives in this
    // suite: a truncated extension alternation, an identifier wrapped across a line,
    // and a marker matched inside prose ABOUT the marker. One class, not four —
    // tokenize, then match.
    const hasUnenforceable = /\bUNENFORCEABLE\b/.test(body);

    if (hasEnforced) tagged++;
    if (hasUnenforceable) unenforceable++;

    if (!hasEnforced && !hasUnenforceable) {
      fail(
        "claude-md",
        `CLAUDE.md:${i + 1}`,
        "a rule in a rules section names neither its enforcement nor why it has none",
        "add `<!-- @enforced <ns>:<id> -->`, or state `UNENFORCEABLE — <reason>` in visible prose",
      );
    }
  }

  // Direction 2: every @enforced tag resolves to a control that exists. A tag that
  // names nothing is decoration. One was wrong on the format's first day — written
  // from memory, slugifying near a real check but not to it.
  const auditSrc = read(join(ROOT, "scripts/architecture-audit.mjs"));
  const known = [...auditSrc.matchAll(/check\("([^"]+)"/g)].map((m) => slug(m[1]));

  for (const m of src.matchAll(/@enforced\s+audit:([^\s>]+)/g)) {
    if (!known.some((k) => k === m[1] || k.startsWith(m[1]))) {
      fail(
        "claude-md",
        `CLAUDE.md:${src.slice(0, m.index).split("\n").length}`,
        `@enforced names audit check "${m[1]}", which does not exist`,
        "derive the id from the check name by slugifying it — do not write it from memory",
      );
    }
  }

  // The binding metric. Total line count moves for scaffolding, scars and
  // orientation, none of which the ratchet is trying to reduce; this number may
  // only fall, except when a new un-mechanisable rule arrives with its reason.
  console.log(`      ↳ ${unenforceable} unenforceable of ${unenforceable + tagged} rules`);
});

// ═══════════════════════════════════════════════════════════════════════════
// KNOWN DEFECTS — the ratchet.
//
// These are REAL bugs, read and classified, not false positives. They are listed
// here so the gate can go green on work that is unrelated to them, while any NEW
// finding still fails the build. The list may only ever SHRINK.
//
// An entry is a debt, not a dismissal. Delete the line when you fix the bug.
//
// All of them share one seam: the AUTOMATED billing path
// (lib/generate-payment-requests.ts) is properly currency-aware, but every
// MANUAL/admin-triggered path bolted on later assumes ZAR. Worth fixing as one
// pass, not five point fixes.
//
// VERIFIED AGAINST PRODUCTION (12 Jul 2026): all 95 invoices and 96 payment
// requests are ZAR, none carry VAT, and site_settings.vatRegistered is FALSE.
// So nobody has been mischarged — every one of these is LATENT. Two triggers arm
// them: (a) flipping vatRegistered to true, and (b) onboarding the first
// international postpaid client. Fix before either happens, not after.
// ═══════════════════════════════════════════════════════════════════════════
const KNOWN_DEFECTS = new Map([
  // ── server-action-ux (opened 2026-08-16) ────────────────────────────────────
  // The `server-action-ux` check was added the day the "can't add or update a
  // client" incident was diagnosed. Every CLIENT-FACING surface it found was fixed
  // the same day: the public booking form, the portal book/cancel/reschedule/notes
  // actions, and the client create/update/relationship actions.
  //
  // What remains below is ADMIN-ONLY. The harm is real but bounded and one person
  // wide: Roxanne sees React's digest text instead of "Campaign name is required",
  // and can tell us. Converting 20 more actions plus their call sites in the same
  // change as the client fix, days before a month-end billing run, buys a small UX
  // win for a large regression surface — so it waits, recorded, rather than
  // shipping half-tested. Each entry is a debt: delete it when the action returns
  // its refusal instead of throwing.
  // adminCreateBookingAction: FIXED 2026-08-17 — converted while adding the P2002
  // slot-clash branch, rather than adding a fourth masked throw to it.
  ["server-action-ux|app/(admin)/admin/(dashboard)/bookings/actions.ts → reinstateBookingAction",
    "'session is in the past and can't be reinstated' — a guard rail, hit rarely and only by admin"],

  ["server-action-ux|app/(admin)/admin/(dashboard)/campaigns/actions.ts → saveBirthdayCampaignAction",
    "'Campaign name is required' — as above"],
  ["server-action-ux|app/(admin)/admin/(dashboard)/campaigns/actions.ts → deleteCampaignAction",
    "'Campaign ID is required' — an internal invariant phrased as a sentence; unreachable from the UI"],
  ["server-action-ux|app/(admin)/admin/(dashboard)/clients/[id]/actions.ts → grantCreditsAction",
    "'Amount must be 1-20' — UNREACHABLE BECAUSE the Grant Credits dialog disables its " +
    "button outside 1-20 and the input is bounded. That is a property of the UI, not of " +
    "this action: if the dialog ever stops bounding the input, this refusal becomes " +
    "reachable and masked, and it needs converting. Left rather than converted because " +
    "changing it today alters nothing anyone can experience."],



  ["server-action-ux|app/(admin)/admin/(dashboard)/drip-emails/actions.ts → updateDripEmailDayOffsetAction",
    "'Day offset must be a non-negative number' — as above"],

  ["server-action-ux|app/(admin)/admin/(dashboard)/gifts/actions.ts → resendGiftEmailAction",
    "'Gift ID required' — an internal invariant phrased as a sentence; unreachable from the UI"],
  ["server-action-ux|app/(admin)/admin/(dashboard)/legal-documents/actions.ts → publishDocumentVersionAction",
    "publish guard rail; admin-only and rare"],
  ["server-action-ux|app/(admin)/admin/(dashboard)/testimonials/actions.ts → createTestimonial",
    "form validation on an admin-only editor"],
  ["server-action-ux|app/(admin)/admin/(dashboard)/testimonials/actions.ts → updateTestimonial",
    "form validation on an admin-only editor"],
  ["server-action-ux|app/(admin)/admin/(dashboard)/testimonials/actions.ts → deleteTestimonial",
    "form validation on an admin-only editor"],


  ["server-action-ux|app/(admin)/admin/(dashboard)/users/actions.ts → deleteUser",
    "'You cannot delete your own account' — UNREACHABLE BECAUSE users/[id]/page.tsx wraps " +
    "the delete button in {!isSelf && ...}. Again a property of the UI: remove that guard " +
    "(say, to let a super admin delete anyone) and this refusal is reachable and masked. " +
    "Its siblings inviteUser/updateUser were converted on 2026-08-18; this one was not, " +
    "because it is a bare <form action> inside an AlertDialog, so surfacing a message means " +
    "rebuilding a DESTRUCTIVE path as a client component with useActionState — real risk on " +
    "an admin-deletion flow, to display a sentence nobody can currently trigger."],
  // RETIRED 2026-08-18: users/actions.ts → changePassword now returns its refusals.
  // Kept as a comment, not an entry: the audit fails if a KNOWN_DEFECTS line stops
  // firing, so a fixed bug must leave the list rather than linger as a tombstone.
]);

check("allowlists: every exemption is still load-bearing", () => {
  // The inverted probe.
  //
  // Every check here is proven by planting a violation and watching it fail. The
  // SUPPRESSORS have never been tested at all — DATE_ALLOWLIST asserts that four
  // files need exempting, and nothing has ever confirmed any of them still does.
  //
  // A stale exemption is worse than a missing one. It reads as a considered
  // decision, it is quoted in the comment above it, and it silently covers
  // whatever gets written into that file next. KNOWN_DEFECTS already fails when
  // an entry stops firing, precisely so a fixed bug cannot linger as a tombstone;
  // an allowlist deserves the same rule and did not have it.
  // DOMAIN_LITERAL_ALLOW gets the same treatment, and it was NOT covered here until
  // the tier-0 crawler found why it needed to be: `lib/copy.ts` sat in this list,
  // exempted "per-region marketing copy", with ZERO imports anywhere in the tree. An
  // exemption was protecting a dead file — the stale-exemption class in its purest
  // form, and invisible to a check that only audited one of the two lists.
  for (const relf of DOMAIN_LITERAL_ALLOW) {
    const abs = join(ROOT, relf);
    if (!existsSync(abs)) {
      fail(
        "allowlists",
        relf,
        "DOMAIN_LITERAL_ALLOW exempts a file that no longer exists",
        "remove the entry — an exemption pointing at nothing still reads as a considered decision",
      );
      continue;
    }
    if (!/life-therapy\.co\.za/.test(read(abs))) {
      fail(
        "allowlists",
        relf,
        "is exempted from the dual-domain rule but no longer contains the literal",
        "remove the entry — it now covers whatever gets written into this file next",
      );
    }
  }

  for (const relf of DATE_ALLOWLIST) {
    const abs = join(ROOT, relf);
    if (!existsSync(abs)) {
      fail(
        "allowlists",
        relf,
        "DATE_ALLOWLIST exempts a file that no longer exists",
        "delete the entry — an exemption outliving its file will silently cover a future file at that path",
      );
      continue;
    }
    // Would this file actually be flagged without its exemption? Run the same two
    // detections the date checks use.
    const src = code(read(abs));
    const raw = read(abs);
    const wouldFlag =
      newDateCalls(src).some((c) => c.args.length >= 3) ||
      /new Date\(\)\s*\.toISOString\(\)\s*\.(slice|substring)\(/.test(src) ||
      /\.toISOString\(\)\s*\.(slice|substring|split)\(/.test(src) ||
      /\+02:?00/.test(raw);

    if (!wouldFlag) {
      fail(
        "allowlists",
        relf,
        "DATE_ALLOWLIST exempts a file that no longer does anything needing exemption",
        "delete the entry — it is now covering whatever gets written here next, under a reason that has stopped being true",
      );
    }
  }

  // ZAR_BY_CONSTRUCTION — same question of the money check's exemptions. These
  // are the higher-stakes ones: an exemption here covers a `formatPrice()` with no
  // currency, which is how an international client is quoted in Rands.
  for (const relf of ZAR_BY_CONSTRUCTION) {
    const abs = join(ROOT, relf);
    if (!existsSync(abs)) {
      fail("allowlists", relf, "ZAR_BY_CONSTRUCTION exempts a file that no longer exists", "delete the entry");
      continue;
    }
    if (!callArity(code(read(abs)), "formatPrice").some((c) => c.args === 1)) {
      fail(
        "allowlists",
        relf,
        "ZAR_BY_CONSTRUCTION exempts a file with no bare formatPrice() left — the exemption is now blanket cover for the next one written here",
        "delete the entry",
      );
    }
  }

  // REVALIDATE_EXCEPTIONS is keyed by ACTION NAME, so it rots differently: a
  // renamed or deleted action leaves an entry that matches nothing, and a name
  // that comes back later — reasonably, for a different action — inherits an
  // exemption written for something else entirely.
  const allActionSrc = allSource()
    .filter((f) => /actions\.ts$/.test(f))
    .map((f) => code(read(f)))
    .join("\n");
  for (const [action, reason] of REVALIDATE_EXCEPTIONS) {
    if (!new RegExp(String.raw`function\s+${action}\b`).test(allActionSrc)) {
      fail(
        "allowlists",
        `REVALIDATE_EXCEPTIONS → ${action}`,
        `exempts an action that no longer exists ("${reason.slice(0, 60)}…")`,
        "delete the entry — if the name returns for a different action it silently inherits this exemption",
      );
    }
  }
});


// ── Report ──────────────────────────────────────────────────────────────────

const isKnown = (f) => KNOWN_DEFECTS.has(`${f.check}|${f.file}`);
const fresh = findings.filter((f) => !isKnown(f));
const known = findings.filter(isKnown);

console.log("");

if (known.length) {
  console.log(`architecture-audit: ${known.length} KNOWN defect(s) — recorded debt, not blocking:`);
  for (const f of known) {
    console.log(`    · ${f.file}`);
    console.log(`      ${KNOWN_DEFECTS.get(`${f.check}|${f.file}`)}`);
  }
  console.log("");
}

// A known-defect entry that no longer fires means the bug was fixed — make the
// author delete the line, so the list can never silently outlive its bugs.
const stale = [...KNOWN_DEFECTS.keys()].filter(
  (k) => !findings.some((f) => `${f.check}|${f.file}` === k),
);
if (stale.length) {
  console.log("architecture-audit: KNOWN_DEFECTS entries that no longer fire — delete them:");
  for (const k of stale) console.log(`    · ${k}`);
  console.log("");
  process.exit(1);
}

if (fresh.length === 0) {
  console.log(`architecture-audit: ${checksRun} checks, no new findings ✓`);
  process.exit(0);
}

console.log(`architecture-audit: ${fresh.length} NEW finding(s) across ${checksRun} checks\n`);
const byCheck = {};
for (const f of fresh) {
  byCheck[f.check] ??= [];
  byCheck[f.check].push(f);
}
for (const [name, list] of Object.entries(byCheck)) {
  console.log(`  ${name}`);
  for (const f of list) {
    console.log(`    ✗ ${f.file}`);
    console.log(`      ${f.msg}`);
    console.log(`      fix: ${f.fix}`);
  }
  console.log("");
}
process.exit(1);
