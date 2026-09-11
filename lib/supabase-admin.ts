import { createClient } from "@supabase/supabase-js";

// Service role client — server-side only, bypasses RLS
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Does `password` open `email`'s account? Checked on a client of its own that holds no cookies, so
 * the caller's session is untouched. Signing in on the request's own client would replace an admin's
 * AAL2 session with an AAL1 one and bounce them to the 2FA step. The session this check creates is
 * signed out at once with scope "local", which revokes that one refresh token and no other.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) return false;
  await client.auth.signOut({ scope: "local" });
  return true;
}
