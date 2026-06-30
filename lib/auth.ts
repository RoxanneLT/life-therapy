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
    redirect("/login");
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!adminUser) {
    redirect("/login");
  }

  // 2FA gate: if the admin has a verified factor but the session is only AAL1,
  // force the step-up. Compute in a try/catch (fail open — opt-in MFA must never
  // lock an admin out over a transient glitch); the redirect is thrown outside it
  // so its NEXT_REDIRECT propagates normally.
  let needsStepUp = false;
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsStepUp = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";
  } catch {
    needsStepUp = false;
  }
  if (needsStepUp) {
    redirect("/login/mfa");
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
