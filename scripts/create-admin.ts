/**
 * One-time script to create the initial super_admin user.
 *
 * Usage:
 *   npx tsx scripts/create-admin.ts
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ADMIN_EMAIL = "hello@life-therapy.co.za";
const ADMIN_PASSWORD = process.env.ADMIN_TEMP_PASSWORD || "CHANGE_ME";
const ADMIN_NAME = "Roxanne";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
    process.exit(1);
  }
  if (!databaseUrl) {
    console.error("Missing DATABASE_URL in env");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    // 1. Create user in Supabase Auth
    console.log(`Creating Supabase Auth user: ${ADMIN_EMAIL}...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });

    if (authError) {
      // If user already exists, fetch their ID instead
      if (authError.message.includes("already been registered")) {
        console.log("Auth user already exists, fetching ID...");
        const { data: listData } = await supabase.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email === ADMIN_EMAIL);
        if (!existing) {
          throw new Error("User exists in Auth but could not be found");
        }
        console.log(`  Found existing auth user: ${existing.id}`);

        // Update password to ensure it matches
        await supabase.auth.admin.updateUserById(existing.id, {
          password: ADMIN_PASSWORD,
        });
        console.log("  Password updated.");

        // 2. Upsert admin_users record
        await upsertAdminRecord(prisma, existing.id);
        return;
      }
      throw authError;
    }

    console.log(`  Auth user created: ${authData.user.id}`);

    // 2. Create admin_users record in database
    await upsertAdminRecord(prisma, authData.user.id);
  } finally {
    await prisma.$disconnect();
  }
}

async function upsertAdminRecord(prisma: PrismaClient, supabaseUserId: string) {
  const existing = await prisma.adminUser.findUnique({
    where: { supabaseUserId },
  });

  if (existing) {
    console.log(`  admin_users record already exists (${existing.id}), updating role...`);
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: { role: "super_admin" },
    });
  } else {
    const record = await prisma.adminUser.create({
      data: {
        supabaseUserId,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        role: "super_admin",
      },
    });
    console.log(`  admin_users record created: ${record.id}`);
  }

  console.log("\nDone! Roxanne can now log in at /admin/login with:");
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: (as set in script)`);
  console.log("\nIMPORTANT: Change the password after first login via Admin > Users.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
