/**
 * Where an admin must go before the admin area, or null when they may enter:
 *   AAL2                   → verified this session             → allowed
 *   AAL1 + nextLevel aal2  → has a factor, must step up        → /login/mfa
 *   AAL1 + nextLevel aal1  → no factor (2FA is mandatory)      → /login/mfa/setup
 *   anything else          → the level could not be read       → /login/mfa
 *
 * Fails CLOSED. It failed open "so a transient glitch never locks an admin out", and that let an
 * admin with no second factor proven into every page and server action whenever the level could
 * not be read. The lookup reports failure by returning `error`, not by throwing, so the catch alone
 * never saw it: `aal` was null, neither branch matched, and the gate said "allowed". Being sent to
 * the challenge page costs an admin a retry; being let in costs the whole point of 2FA (pleks
 * comparison, 2026-10-09, item 5).
 */
export async function mfaGateTarget(supabase: {
  auth: { mfa: { getAuthenticatorAssuranceLevel(): Promise<{ data: { currentLevel: string | null; nextLevel: string | null } | null; error: unknown }> } };
}): Promise<string | null> {
  try {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal) return "/login/mfa";
    if (aal.currentLevel === "aal2") return null;
    if (aal.currentLevel === "aal1" && aal.nextLevel === "aal1") return "/login/mfa/setup";
    return "/login/mfa";
  } catch {
    return "/login/mfa";
  }
}
