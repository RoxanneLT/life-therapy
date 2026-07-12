/**
 * lib/env.ts — the accessor's contract.
 *
 * The load-bearing behaviours: requireEnv FAILS CLOSED (throws a named error, never
 * returns "undefined"), isConfigured is all-or-nothing (a half-set integration reads
 * as off), and missingRequiredEnv reports the whole set so a health check sees them
 * all at once.
 *
 * Run: npm run test:env  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { env, requireEnv, envOr, isConfigured, missingRequiredEnv } from "./env";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("env() returns the value, or undefined for unset / empty", () => {
  withEnv({ PAYSTACK_SECRET_KEY: "sk_test_123" }, () => {
    assert.equal(env("PAYSTACK_SECRET_KEY"), "sk_test_123");
  });
  withEnv({ PAYSTACK_SECRET_KEY: undefined }, () => {
    assert.equal(env("PAYSTACK_SECRET_KEY"), undefined);
  });
  // An empty string is treated as unset — a blank var is not a configured one.
  withEnv({ PAYSTACK_SECRET_KEY: "" }, () => {
    assert.equal(env("PAYSTACK_SECRET_KEY"), undefined);
  });
});

test("requireEnv throws a NAMED error rather than returning undefined", () => {
  withEnv({ RESEND_API_KEY: undefined }, () => {
    assert.throws(
      () => requireEnv("RESEND_API_KEY"),
      /Missing required environment variable: RESEND_API_KEY/,
    );
  });
  withEnv({ RESEND_API_KEY: "re_live_x" }, () => {
    assert.equal(requireEnv("RESEND_API_KEY"), "re_live_x");
  });
});

test("envOr falls back only when the var is unset", () => {
  withEnv({ BUNNY_STORAGE_REGION: "ny" }, () => {
    assert.equal(envOr("BUNNY_STORAGE_REGION", "de"), "ny");
  });
  withEnv({ BUNNY_STORAGE_REGION: undefined }, () => {
    assert.equal(envOr("BUNNY_STORAGE_REGION", "de"), "de");
  });
});

test("isConfigured is all-or-nothing — a half-set integration reads as OFF", () => {
  // The point: SMTP with a host but no password must NOT read as configured, or
  // the send path tries to use it and fails mid-request.
  withEnv(
    { SMTP_HOST: "smtp.example", SMTP_PORT: "587", SMTP_USER: "u", SMTP_PASS: undefined },
    () => {
      assert.equal(isConfigured("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"), false);
    },
  );
  withEnv(
    { SMTP_HOST: "smtp.example", SMTP_PORT: "587", SMTP_USER: "u", SMTP_PASS: "p" },
    () => {
      assert.equal(isConfigured("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"), true);
    },
  );
});

test("missingRequiredEnv reports the whole set, not just the first", () => {
  withEnv(
    {
      DATABASE_URL: undefined,
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: "svc",
    },
    () => {
      const missing = missingRequiredEnv();
      assert.ok(missing.includes("DATABASE_URL"));
      assert.ok(missing.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
      assert.ok(!missing.includes("NEXT_PUBLIC_SUPABASE_URL"), "a present var is not reported");
      assert.ok(!missing.includes("SUPABASE_SERVICE_ROLE_KEY"));
    },
  );
});
