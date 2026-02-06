import { config } from "dotenv";
config({ path: ".env.local" });
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });

// 1. Find the sessions page
const { rows: pages } = await pool.query(
  `SELECT id, slug, title FROM pages WHERE slug = 'sessions'`
);
console.log("Sessions page:", pages);

if (!pages.length) {
  // Try other slugs
  const { rows: allPages } = await pool.query(`SELECT id, slug, title FROM pages`);
  console.log("All pages:", allPages);
  await pool.end();
  process.exit(0);
}

const pageId = pages[0].id;

// 2. Get all sections for the sessions page
const { rows: sections } = await pool.query(
  `SELECT id, title, "sectionType", "ctaText", "ctaLink", config FROM page_sections WHERE "pageId" = $1 ORDER BY "sortOrder"`,
  [pageId]
);

console.log("\n--- Sessions page sections ---");
for (const s of sections) {
  console.log(`\n[${s.sectionType}] "${s.title}"`);
  if (s.ctaLink) console.log(`  CTA: "${s.ctaText}" -> ${s.ctaLink}`);
  if (s.config) {
    const cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
    if (cfg.items) {
      for (const item of cfg.items) {
        console.log(`  Item: "${item.title}" -> ctaLink: ${item.ctaLink || "(none)"}, ctaText: ${item.ctaText || "(none)"}`);
      }
    }
  }
}

// 3. Update pricing section items with correct type params
for (const s of sections) {
  if (s.config) {
    const cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
    if (cfg.items) {
      let changed = false;
      cfg.items = cfg.items.map((item) => {
        // Match by title to assign correct type
        if (item.title && item.title.toLowerCase().includes("free")) {
          if (item.ctaLink !== "/book?type=free_consultation") {
            changed = true;
            return { ...item, ctaLink: "/book?type=free_consultation" };
          }
        } else if (item.title && (item.title.toLowerCase().includes("individual") || item.title.toLowerCase().includes("1:1"))) {
          if (item.ctaLink !== "/book?type=individual") {
            changed = true;
            return { ...item, ctaLink: "/book?type=individual" };
          }
        } else if (item.title && item.title.toLowerCase().includes("couple")) {
          if (item.ctaLink !== "/book?type=couples") {
            changed = true;
            return { ...item, ctaLink: "/book?type=couples" };
          }
        }
        return item;
      });
      if (changed) {
        await pool.query(`UPDATE page_sections SET config = $1 WHERE id = $2`, [JSON.stringify(cfg), s.id]);
        console.log(`\nUpdated config items for section: "${s.title}"`);
      }
    }
  }

  // Update section-level CTA links
  if (s.ctaLink && s.ctaLink.includes("/book")) {
    // For a generic sessions page CTA, default to free consultation
    // unless the title suggests a specific type
    let newLink = "/book?type=free_consultation";
    if (s.title && s.title.toLowerCase().includes("individual")) {
      newLink = "/book?type=individual";
    } else if (s.title && s.title.toLowerCase().includes("couple")) {
      newLink = "/book?type=couples";
    }
    if (s.ctaLink !== newLink) {
      await pool.query(`UPDATE page_sections SET "ctaLink" = $1 WHERE id = $2`, [newLink, s.id]);
      console.log(`\nUpdated section CTA: "${s.title}" -> ${newLink}`);
    }
  }
}

// 4. Also check ALL pricing sections across all pages for completeness
console.log("\n\n--- All pricing sections across all pages ---");
const { rows: allPricing } = await pool.query(
  `SELECT ps.id, ps.title, ps.config, p.slug as page_slug
   FROM page_sections ps
   JOIN pages p ON ps."pageId" = p.id
   WHERE ps."sectionType" = 'pricing'`
);
for (const s of allPricing) {
  const cfg = typeof s.config === "string" ? JSON.parse(s.config) : s.config;
  if (cfg?.items) {
    console.log(`\n[${s.page_slug}] "${s.title}"`);
    for (const item of cfg.items) {
      console.log(`  "${item.title}" -> ${item.ctaLink || "(none)"}`);
    }
  }
}

await pool.end();
console.log("\nDone");
