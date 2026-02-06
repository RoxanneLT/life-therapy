import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

// Update all section-level CTA links that are exactly '/book' to include free_consultation type
const { rowCount } = await pool.query(
  `UPDATE page_sections SET "ctaLink" = '/book?type=free_consultation' WHERE "ctaLink" = '/book'`
);
console.log(`Updated ${rowCount} section-level CTA links from /book to /book?type=free_consultation`);

// Verify no bare /book links remain
const { rows } = await pool.query(
  `SELECT ps.id, ps.title, ps."ctaLink", p.slug
   FROM page_sections ps
   JOIN pages p ON ps."pageId" = p.id
   WHERE ps."ctaLink" LIKE '%/book%'
   ORDER BY p.slug`
);
console.log("\nAll sections with /book links:");
for (const r of rows) {
  console.log(`  [${r.slug}] "${r.title}" -> ${r.ctaLink}`);
}

// Also check config items in pricing sections
const { rows: pricing } = await pool.query(
  `SELECT ps.id, ps.title, ps.config, p.slug
   FROM page_sections ps
   JOIN pages p ON ps."pageId" = p.id
   WHERE ps."sectionType" = 'pricing'`
);
console.log("\nPricing section items:");
for (const s of pricing) {
  const cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
  if (cfg?.items) {
    for (const item of cfg.items) {
      if (item.ctaLink) {
        console.log(`  [${s.slug}] "${item.title}" -> ${item.ctaLink}`);
      }
    }
  }
}

await pool.end();
console.log("\nDone");
