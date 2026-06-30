"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isRateLimitedDb, recordHitDb, clearRateLimitDb, hashIdentifier } from "@/lib/rate-limit-db";
import { recordAuthEvent } from "@/lib/audit";

const IP_LIMIT = 5; // failed attempts per IP before lockout
const EMAIL_LIMIT = 10; // failed attempts per email — higher, so it backstops a
// distributed attack on one account without being an easy way to lock a victim out
// (and a password reset clears it anyway).
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginResult {
  ok?: true;
  error?: string;
}

/**
 * Server-side password sign-in with durable, per-IP + per-email brute-force
 * throttling (rate_limits table — survives serverless cold starts). Running the
 * auth on the server is what makes the throttle real; a purely client-side
 * signInWithPassword has no app-level limit. Only FAILED attempts count; a
 * successful sign-in clears both buckets. Errors are uniform (no enumeration).
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
  const ipKey = `login:ip:${ip}`;
  const emailKey = `login:email:${hashIdentifier(cleanEmail)}`;

  if ((await isRateLimitedDb(ipKey, IP_LIMIT)) || (await isRateLimitedDb(emailKey, EMAIL_LIMIT))) {
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
    await recordHitDb(ipKey, WINDOW_MS);
    await recordHitDb(emailKey, WINDOW_MS);
    await recordAuthEvent({ action: "login_failure", email: cleanEmail, ip, userAgent, reason: "invalid_credentials" });
    return { error: "Incorrect email or password." };
  }

  await clearRateLimitDb(ipKey);
  await clearRateLimitDb(emailKey);
  await recordAuthEvent({ action: "login_success", email: cleanEmail, ip, userAgent, userId: data.user?.id ?? null });
  return { ok: true };
}
