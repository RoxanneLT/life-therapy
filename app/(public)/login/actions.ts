"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isRateLimited, recordHit, clearRateLimit } from "@/lib/rate-limit";
import { recordAuthEvent } from "@/lib/audit";

const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginResult {
  ok?: true;
  error?: string;
}

/**
 * Server-side password sign-in with per-IP brute-force throttling.
 *
 * Running the auth on the server is what makes the rate limit real — a purely
 * client-side signInWithPassword has no app-level throttle and can be scripted.
 * Only FAILED attempts are counted (a successful sign-in clears the counter), so
 * legitimate users who mistype a couple of times aren't punished. Errors are
 * uniform so the response never reveals whether an email exists.
 *
 * On success the session cookies are set on the response by the SSR client; the
 * caller then routes by role / redirects.
 */
export async function passwordSignInAction(
  email: string,
  password: string,
): Promise<LoginResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { error: "Please enter your email and password." };
  }

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  const userAgent = h.get("user-agent") ?? undefined;
  const key = `login:${ip}`;

  if (isRateLimited(key, LOGIN_LIMIT)) {
    await recordAuthEvent({ action: "login_failure", email: cleanEmail, ip, userAgent, reason: "rate_limited" });
    return {
      error: "Too many sign-in attempts. Please wait 15 minutes and try again.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (error) {
    recordHit(key, LOGIN_WINDOW_MS);
    await recordAuthEvent({ action: "login_failure", email: cleanEmail, ip, userAgent, reason: "invalid_credentials" });
    return { error: "Incorrect email or password." };
  }

  clearRateLimit(key);
  await recordAuthEvent({ action: "login_success", email: cleanEmail, ip, userAgent, userId: data.user?.id ?? null });
  return { ok: true };
}
