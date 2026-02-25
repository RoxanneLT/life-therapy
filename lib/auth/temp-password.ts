/**
 * Generate a temporary password for auto-provisioned accounts.
 * Format: "LT-" + 6 random alphanumeric chars + "!"
 * Meets Supabase minimum password requirements (>= 6 chars).
 * Excludes ambiguous characters (0, O, l, 1, I).
 */
export function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "LT-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result + "!";
}
