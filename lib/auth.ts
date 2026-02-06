import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import type { AdminRole } from "@/lib/generated/prisma/client";

export async function getAuthenticatedAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!adminUser) {
    redirect("/admin/login");
  }

  return { user, adminUser };
}

/**
 * Check if the current admin has one of the required roles.
 * Redirects to /admin if the user doesn't have permission.
 */
export async function requireRole(...roles: AdminRole[]) {
  const { user, adminUser } = await getAuthenticatedAdmin();

  if (!roles.includes(adminUser.role)) {
    redirect("/admin");
  }

  return { user, adminUser };
}
