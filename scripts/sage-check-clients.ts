/**
 * Sage transition import — Step 1: Client matching check
 *
 * Compares Sage client names against Life Therapy Student records.
 * Run BEFORE the import to confirm which clients exist and which need to be created.
 *
 * Usage:
 *   npx tsx scripts/sage-check-clients.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Sage data (from screenshot) ────────────────────────────────────────────
// Update amounts/dates once you have the full CSV export
const SAGE_RECORDS = [
  { sage_name: "Heather White (Micaella)", ref: "MW-LT", date: "2026-03-04", total_rand: 895 },
  { sage_name: "Tasmin Mackier",           ref: "TM-LT", date: "2026-03-04", total_rand: 895 },
  { sage_name: "Gen Jurgens (Kay Jurgens)",ref: "KJ-LT", date: "2026-03-04", total_rand: 895 },
  { sage_name: "Sheena Muirden",           ref: "SM-LT", date: "2026-03-05", total_rand: 895 },
  { sage_name: "Daniel Van Niekerk",       ref: "DVN-LT",date: "2026-03-09", total_rand: 895 },
  { sage_name: "Genna Scott",              ref: "GS-LT", date: "2026-03-04", total_rand: 1790 },
  { sage_name: "Franco Popolillo",         ref: "FP-LT", date: "2026-03-09", total_rand: 895 },
  { sage_name: "Lisa Toms",                ref: "LT-LT", date: "2026-03-04", total_rand: 1790 },
  { sage_name: "Chantal Blanche",          ref: "CB-LT", date: "2026-03-10", total_rand: 895 },
  { sage_name: "Colleen McMahon",          ref: "CM-LT", date: "2026-03-10", total_rand: 895 },
  { sage_name: "Chan? Buys",               ref: "CB-LT", date: "2026-03-10", total_rand: 895 },
  { sage_name: "Frikkie Erasmus",          ref: "FE-LT", date: "2026-03-04", total_rand: 1790 },
  { sage_name: "Cheslon Faroa",            ref: "CF-LT", date: "2026-03-11", total_rand: 895 },
  { sage_name: "Anika Roberts",            ref: "AR-LT", date: "2026-03-04", total_rand: 1790 },
  { sage_name: "Andrea Behnsen",           ref: "AB-LT", date: "2026-03-11", total_rand: 895 },
  { sage_name: "Huibri Smith",             ref: "HS-LT", date: "2026-03-12", total_rand: 895 },
  { sage_name: "Caroline Meihuizen",       ref: "CM-LT", date: "2026-03-02", total_rand: 1790 },
  { sage_name: "Anneline Swingler",        ref: "AS-LT", date: "2026-03-09", total_rand: 1790 },
  { sage_name: "Winifred & Ricardo Michaels", ref: "WRM-LT", date: "2026-03-02", total_rand: 1295 },
  { sage_name: "Gloria Killian (Aiden)",   ref: "AK-LT", date: "2026-03-02", total_rand: 1790 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Strip parenthetical notes like "(Micaella)" or "(Kay Jurgens)" */
function stripParens(name: string) {
  return name.replaceAll(/\s*\(.*?\)/g, "").replaceAll("?", "").trim();
}

/** Normalise for comparison: lowercase, collapse whitespace */
function normalise(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Returns true if a Student is a plausible match for the cleaned Sage name */
function isMatch(student: { firstName: string; lastName: string }, cleaned: string): boolean {
  const full = normalise(`${student.firstName} ${student.lastName}`);
  const cn = normalise(cleaned);
  if (full === cn) return true;
  // Partial: both words appear
  const parts = cn.split(" ");
  return parts.every((p) => full.includes(p));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const students = await prisma.student.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  console.log(`\nChecking ${SAGE_RECORDS.length} Sage records against ${students.length} Life Therapy clients\n`);
  console.log("─".repeat(80));

  const matched: typeof SAGE_RECORDS = [];
  const unmatched: typeof SAGE_RECORDS = [];
  const ambiguous: typeof SAGE_RECORDS = [];

  for (const record of SAGE_RECORDS) {
    const cleaned = stripParens(record.sage_name);
    const matches = students.filter((s) => isMatch(s, cleaned));

    const sessions = inferSessions(record.total_rand);
    const label = `${record.sage_name.padEnd(35)} [${record.ref.padEnd(8)}] R${record.total_rand} (${sessions})`;

    if (matches.length === 1) {
      const s = matches[0];
      console.log(`✅  ${label}`);
      console.log(`    → ${s.firstName} ${s.lastName} <${s.email}> (${s.id})`);
      matched.push(record);
    } else if (matches.length > 1) {
      console.log(`⚠️  AMBIGUOUS: ${label}`);
      matches.forEach((s) => console.log(`    ? ${s.firstName} ${s.lastName} <${s.email}>`));
      ambiguous.push(record);
    } else {
      console.log(`❌  NOT FOUND: ${label}`);
      unmatched.push(record);
    }
  }

  console.log("\n" + "─".repeat(80));
  console.log(`\nSummary:`);
  console.log(`  ✅  Matched:   ${matched.length}`);
  console.log(`  ⚠️  Ambiguous: ${ambiguous.length}`);
  console.log(`  ❌  Not found: ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log(`\nClients to create before import:`);
    unmatched.forEach((r) => console.log(`  - ${r.sage_name} (${r.ref})`));
  }

  console.log("\nOnce all clients are confirmed/created, run: npx tsx scripts/sage-import-invoices.ts\n");
}

function inferSessions(totalRand: number): string {
  const INDIVIDUAL = 895;
  const COUPLES = 1295;
  if (totalRand % INDIVIDUAL === 0) {
    const n = totalRand / INDIVIDUAL;
    return `${n}× individual`;
  }
  if (totalRand % COUPLES === 0) {
    const n = totalRand / COUPLES;
    return `${n}× couples`;
  }
  // Fallback: mixed
  return `R${totalRand} — check manually`;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
