import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

// 1. Update pricing section cards with type params
const { rows } = await pool.query(
  `SELECT id, config FROM page_sections WHERE "sectionType" = 'pricing' AND title = 'Booking Options'`
);
if (rows.length) {
  const cfg = rows[0].config;
  cfg.items = cfg.items.map((item) => {
    if (item.title === "Free Consultation") return { ...item, ctaLink: "/book?type=free_consultation" };
    if (item.title === "1:1 Session") return { ...item, ctaLink: "/book?type=individual" };
    if (item.title === "Couples Session") return { ...item, ctaLink: "/book?type=couples" };
    return item;
  });
  await pool.query(`UPDATE page_sections SET config = $1 WHERE id = $2`, [JSON.stringify(cfg), rows[0].id]);
  console.log("Updated pricing cards with type params");
}

// 2. Update CTA sections that link to /book -> /book?type=free_consultation
const r2 = await pool.query(`SELECT id, title, "ctaLink" FROM page_sections WHERE "ctaLink" = '/book'`);
console.log("CTA sections linking to /book:", r2.rows.length);
for (const row of r2.rows) {
  await pool.query(`UPDATE page_sections SET "ctaLink" = $1 WHERE id = $2`, ["/book?type=free_consultation", row.id]);
  console.log("  Updated:", row.title);
}

await pool.end();
console.log("Done");
