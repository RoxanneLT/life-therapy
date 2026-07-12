import { createSupabaseServerClient } from "./supabase-server";
import { prisma } from "./prisma";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AdminRole } from "@/lib/generated/prisma/client";

/**
 * The PURE half of the admin auth check — verify the user, load the adminUser row,
 * and COMPUTE (not act on) the MFA gate. Wrapped in React.cache so an admin render
 * tree that gates in several places (layout + page + a data-fetching component) pays
 * one auth.getUser() + one adminUser lookup, not one per call site.
 *
 * It has NO side effects: it returns a gateTarget rather than redirecting, so caching
 * it is safe and the NEXT_REDIRECT throw stays entirely in the wrapper below. Keyed on
 * the skipMfaGate boolean (a primitive, so cache dedupes by value) — the two keys never
 * share a result.
 *
 * 2FA gate (computed in a try/catch — fail open, never lock an admin out over a
 * transient glitch; the setup/challenge pages pass skipMfaGate to avoid a loop):
 *   AAL1 + nextLevel aal2  → has a factor, must step up        → /login/mfa
 *   AAL1 + nextLevel aal1  → no factor (2FA is mandatory)      → /login/mfa/setup
 *   AAL2                   → verified this session             → allowed
 */
const loadAdminContext = cache(async (skipMfaGate: boolean) => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, adminUser: null, gateTarget: null };
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { supabaseUserId: user.id },
  });

  if (!adminUser) {
    return { user, adminUser: null, gateTarget: null };
  }

  let gateTarget: string | null = null;
  if (!skipMfaGate) {
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

  return { user, adminUser, gateTarget };
});

export async function getAuthenticatedAdmin(opts?: { skipMfaGate?: boolean }) {
  const { user, adminUser, gateTarget } = await loadAdminContext(opts?.skipMfaGate ?? false);

  // Every redirect lives HERE, outside the cached (and try/catch'd) read, so
  // NEXT_REDIRECT always propagates cleanly and is never swallowed or memoised.
  if (!user) {
    redirect("/login");
  }
  if (!adminUser) {
    redirect("/login");
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
