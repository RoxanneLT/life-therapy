import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any);

  // Get all existing bundles with their courses
  const bundles = await prisma.bundle.findMany({
    include: {
      bundleCourses: {
        orderBy: { sortOrder: "asc" },
        select: { courseId: true, sortOrder: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  console.log(`Found ${bundles.length} bundles to migrate.\n`);

  for (const bundle of bundles) {
    // Check if already migrated (same slug exists in HybridPackage)
    const existing = await prisma.hybridPackage.findUnique({
      where: { slug: bundle.slug },
    });
    if (existing) {
      console.log(`Skipping "${bundle.title}" — already exists in packages.`);
      continue;
    }

    await prisma.hybridPackage.create({
      data: {
        title: bundle.title,
        slug: bundle.slug,
        description: bundle.description,
        imageUrl: bundle.imageUrl,
        priceCents: bundle.price,
        credits: 0,
        isPublished: bundle.isPublished,
        sortOrder: bundle.sortOrder,
        courses: {
          create: bundle.bundleCourses.map((bc) => ({
            courseId: bc.courseId,
            sortOrder: bc.sortOrder,
          })),
        },
      },
    });
    console.log(
      `Migrated: ${bundle.title} (${bundle.bundleCourses.length} courses, ${bundle.price / 100} ZAR)`
    );
  }

  console.log("\nDone! All bundles migrated to HybridPackage.");
  await pool.end();
}

main().catch(console.error);
