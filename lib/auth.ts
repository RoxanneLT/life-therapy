import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import type { AdminRole } from "@/lib/generated/prisma/client";

export async function getAuthenticatedAdmin(opts?: { skipMfaGate?: boolean }) {
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

  // 2FA gate. Computed in a try/catch (fail open — never lock an admin out over a
  // transient glitch); the redirect is thrown OUTSIDE it so NEXT_REDIRECT
  // propagates. The setup/challenge pages pass skipMfaGate to avoid a loop.
  //   AAL1 + nextLevel aal2  → has a factor, must step up        → /login/mfa
  //   AAL1 + nextLevel aal1  → no factor (2FA is mandatory)      → /login/mfa/setup
  //   AAL2                   → verified this session             → allowed
  let gateTarget: string | null = null;
  if (!opts?.skipMfaGate) {
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
        gateTarget = "/login/mfa";
      } else if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal1") {
        gateTarget = "/login/mfa/setup";
      }
    } catch {
      gateTarget = null;
    }
  }
  if (gateTarget) {
    redirect(gateTarget);
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
