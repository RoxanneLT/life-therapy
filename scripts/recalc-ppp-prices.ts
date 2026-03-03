/**
 * One-off script: recalculate USD / EUR / GBP prices from ZAR
 * using PPP divisors + beautify (round to nearest 100 then -1 → ends in 99).
 *
 * Run with:  npx tsx scripts/recalc-ppp-prices.ts
 */

import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PPP_DIVISORS = { USD: 13, EUR: 14, GBP: 17 } as const;

function beautify(cents: number): number {
  if (cents <= 0) return 0;
  const rounded = Math.round(cents / 100) * 100;
  return Math.max(99, rounded - 1);
}

function ppp(zarCents: number) {
  return {
    usd: beautify(zarCents / PPP_DIVISORS.USD),
    eur: beautify(zarCents / PPP_DIVISORS.EUR),
    gbp: beautify(zarCents / PPP_DIVISORS.GBP),
  };
}

async function main() {
  // ── Courses ──
  const courses = await prisma.course.findMany({ select: { id: true, title: true, price: true } });
  for (const c of courses) {
    if (c.price <= 0) continue;
    const p = ppp(c.price);
    await prisma.course.update({
      where: { id: c.id },
      data: { priceUsd: p.usd, priceEur: p.eur, priceGbp: p.gbp },
    });
    console.log(`Course "${c.title}": ZAR ${c.price} → USD ${p.usd} / EUR ${p.eur} / GBP ${p.gbp}`);
  }

  // ── Modules (standalone) ──
  const modules = await prisma.module.findMany({
    select: { id: true, title: true, standalonePrice: true },
    where: { standalonePrice: { not: null, gt: 0 } },
  });
  for (const m of modules) {
    const zar = m.standalonePrice!;
    const p = ppp(zar);
    await prisma.module.update({
      where: { id: m.id },
      data: { standalonePriceUsd: p.usd, standalonePriceEur: p.eur, standalonePriceGbp: p.gbp },
    });
    console.log(`Module "${m.title}": ZAR ${zar} → USD ${p.usd} / EUR ${p.eur} / GBP ${p.gbp}`);
  }

  // ── Digital Products ──
  const products = await prisma.digitalProduct.findMany({
    select: { id: true, title: true, priceCents: true },
  });
  for (const d of products) {
    if (d.priceCents <= 0) continue;
    const p = ppp(d.priceCents);
    await prisma.digitalProduct.update({
      where: { id: d.id },
      data: { priceCentsUsd: p.usd, priceCentsEur: p.eur, priceCentsGbp: p.gbp },
    });
    console.log(`Digital Product "${d.title}": ZAR ${d.priceCents} → USD ${p.usd} / EUR ${p.eur} / GBP ${p.gbp}`);
  }

  // ── Packages ──
  const packages = await prisma.hybridPackage.findMany({
    select: { id: true, title: true, priceCents: true },
  });
  for (const pkg of packages) {
    if (pkg.priceCents <= 0) continue;
    const p = ppp(pkg.priceCents);
    await prisma.hybridPackage.update({
      where: { id: pkg.id },
      data: { priceCentsUsd: p.usd, priceCentsEur: p.eur, priceCentsGbp: p.gbp },
    });
    console.log(`Package "${pkg.title}": ZAR ${pkg.priceCents} → USD ${p.usd} / EUR ${p.eur} / GBP ${p.gbp}`);
  }

  console.log("\nDone! All international prices recalculated.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
