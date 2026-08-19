/**
 * Sign a browser session out, completely.
 *
 * One implementation because the interesting half is a workaround, not a call:
 * `supabase.auth.signOut()` leaves chunked `sb-*` cookies behind, and a stale
 * fragment reads as a partially-valid session. That teardown stood duplicated
 * byte-for-byte in the admin header and the portal header — so a correction to it,
 * or a new cookie prefix to clear, would have reached one surface and left the
 * other holding fragments of a session the user believes they ended.
 *
 * Classified up from "UI tidying" on 2026-08-19 by reading it rather than its name
 * (dev-standards/LESSONS.md L-27): two identical `handleSignOut` bodies look like
 * boilerplate in a duplication report and are session teardown in the file.
 */
import { createBrowserClient } from "@/lib/supabase";

export async function signOutCompletely(): Promise<void> {
  const supabase = createBrowserClient();
  await supabase.auth.signOut({ scope: "local" });
  // Clear ALL Supabase chunked auth cookies to prevent stale fragments
  document.cookie.split(";").forEach((c) => {
    const name = c.trim().split("=")[0];
    if (name.startsWith("sb-")) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
}
