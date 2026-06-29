/**
 * Backfill stored phone numbers to canonical E.164.
 *
 * Handles encrypted phone fields — decrypts, normalises, re-encrypts. Idempotent:
 * a number already in E.164 is left untouched; invalid/unparseable numbers are left
 * as-is (counted as "unchanged").
 *
 * SiteSetting.phone is intentionally NOT touched — it's the public contact number
 * shown (formatted) in the footer / JSON-LD and is managed by the admin directly.
 *
 * Dry-run by default (no writes). Add --apply to persist:
 *   npx tsx scripts/normalize-phone-numbers.ts            # preview
 *   npx tsx scripts/normalize-phone-numbers.ts --apply    # write
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { decrypt, encrypt } from "../lib/encryption";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes("--apply");

/**
 * Pure (no libphonenumber) E.164 normaliser for the backfill. Mirrors lib/phone's
 * SA-strict rule; light-touch for foreign (+ / 00 prefixes). The tsx loader can't
 * load libphonenumber's metadata, so the app uses lib/phone and this script uses
 * this equivalent regex form. Returns the input unchanged when it can't normalise.
 */
function normalizeForStorage(raw: string): string {
  const v = raw.trim();
  if (!v) return v;
  const compact = v.replace(/[\s()\-.]/g, "");
  if (/^0\d{9}$/.test(compact)) return `+27${compact.slice(1)}`;        // 082… → +2782…
  if (/^0027\d{9}$/.test(compact)) return `+27${compact.slice(4)}`;     // 0027… → +27…
  if (/^27\d{9}$/.test(compact)) return `+${compact}`;                  // 2782… → +2782…
  if (/^\+\d{7,15}$/.test(compact)) return compact;                     // already + (strip spaces)
  if (/^00\d{6,14}$/.test(compact)) return `+${compact.slice(2)}`;      // 00<intl> → +<intl>
  return v;                                                            // unknown — leave as-is
}

interface Row {
  id: string;
  phone: string | null;
  label: string;
}

/** Decrypt → normalise → (encrypt + write when --apply). Logs a per-row summary. */
async function processBatch(
  title: string,
  rows: Row[],
  write: (id: string, encrypted: string) => Promise<unknown>,
): Promise<void> {
  let changed = 0;
  let unchanged = 0;
  for (const row of rows) {
    if (!row.phone) continue;
    const decrypted = decrypt(row.phone);
    const normalized = normalizeForStorage(decrypted);
    if (normalized === decrypted) {
      unchanged++;
      continue;
    }
    console.log(`  ${row.label} — ${decrypted} → ${normalized}`);
    if (APPLY) await write(row.id, encrypt(normalized));
    changed++;
  }
  console.log(`\n${title}: ${changed} changed, ${unchanged} unchanged of ${rows.length}\n`);
}

async function main() {
  console.log(`=== Phone Number Normalisation (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const students = await prisma.student.findMany({
    where: { phone: { not: null } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  await processBatch(
    "Students",
    students.map((s) => ({ id: s.id, phone: s.phone, label: `Student: ${s.firstName} ${s.lastName}` })),
    (id, encrypted) => prisma.student.update({ where: { id }, data: { phone: encrypted } }),
  );

  const bookings = await prisma.booking.findMany({
    where: { clientPhone: { not: null } },
    select: { id: true, clientName: true, clientPhone: true },
  });
  await processBatch(
    "Bookings",
    bookings.map((b) => ({ id: b.id, phone: b.clientPhone, label: `Booking: ${b.clientName}` })),
    (id, encrypted) => prisma.booking.update({ where: { id }, data: { clientPhone: encrypted } }),
  );

  const entities = await prisma.billingEntity.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true },
  });
  await processBatch(
    "Billing entities",
    entities.map((e) => ({ id: e.id, phone: e.phone, label: `Entity: ${e.name}` })),
    (id, encrypted) => prisma.billingEntity.update({ where: { id }, data: { phone: encrypted } }),
  );

  console.log(`=== ${APPLY ? "Done — changes written." : "Dry run complete — re-run with --apply to write."} ===`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
