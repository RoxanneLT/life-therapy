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
  "lib/sa-public-holidays.ts", // derives from Date.UTC(...)
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

check("money: formatPrice always passes a currency", () => {
  for (const f of allSource()) {
    if (ZAR_BY_CONSTRUCTION.has(rel(f))) continue;
    const src = code(read(f));
    // formatPrice(x) with no second argument.
    const m = src.match(/formatPrice\(\s*[^,)]+\)/g);
    if (m) {
      fail(
        "money",
        rel(f),
        `${m.length} formatPrice() call(s) with no currency: ${m[0].slice(0, 40)}`,
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

// ═══════════════════════════════════════════════════════════════════════════
// 5. SCHEMA / MIGRATIONS
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
  // Empty. Every entry was fixed in the multi-currency billing pass.
  // Add one only when a real, classified defect must wait — never to silence noise.
]);

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
