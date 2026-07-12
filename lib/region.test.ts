/**
 * Region → URL resolution.
 *
 * The load-bearing invariant: production serves BOTH domains from one deployment,
 * so a URL must follow the client's region. The `NEXT_PUBLIC_APP_URL` override was
 * defeating that — it short-circuited the region branch, so every international
 * client's email/PDF link resolved to .co.za. The fix restricts the override to
 * non-production. These fixtures pin both halves.
 *
 * Run: npm run test:region  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getBaseUrlForRegion,
  getBaseUrlForCurrency,
  regionForCurrency,
  appBaseUrl,
} from "./region";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
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

test("in PRODUCTION the URL follows the region, not NEXT_PUBLIC_APP_URL", () => {
  // The bug: NEXT_PUBLIC_APP_URL (set to .co.za, the single env scope for both
  // domains) overrode the region branch, so an international client got .co.za.
  withEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://life-therapy.co.za" }, () => {
    assert.equal(getBaseUrlForRegion("za"), "https://life-therapy.co.za");
    assert.equal(
      getBaseUrlForRegion("int"),
      "https://life-therapy.online",
      "an international client MUST get .online even when the env var says .co.za",
    );
  });
});

test("in DEV the env override is honoured (localhost / preview)", () => {
  withEnv({ NODE_ENV: "development", NEXT_PUBLIC_APP_URL: "http://localhost:3000" }, () => {
    assert.equal(getBaseUrlForRegion("za"), "http://localhost:3000");
    assert.equal(getBaseUrlForRegion("int"), "http://localhost:3000");
  });
});

test("region is derived from the client's currency", () => {
  assert.equal(regionForCurrency("ZAR"), "za");
  assert.equal(regionForCurrency("USD"), "int");
  assert.equal(regionForCurrency("EUR"), "int");
  assert.equal(regionForCurrency("GBP"), "int");
  assert.equal(regionForCurrency(null), "za", "no currency → default ZA");
  assert.equal(regionForCurrency(undefined), "za");
});

test("getBaseUrlForCurrency sends each recipient to their own domain", () => {
  withEnv({ NODE_ENV: "production", NEXT_PUBLIC_APP_URL: "https://life-therapy.co.za" }, () => {
    assert.equal(getBaseUrlForCurrency("ZAR"), "https://life-therapy.co.za");
    assert.equal(getBaseUrlForCurrency("USD"), "https://life-therapy.online");
    assert.equal(getBaseUrlForCurrency(null), "https://life-therapy.co.za");
  });
});

test("appBaseUrl folds the two env vars and strips a trailing slash", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: "https://life-therapy.co.za/", NEXT_PUBLIC_BASE_URL: undefined }, () => {
    assert.equal(appBaseUrl(), "https://life-therapy.co.za");
  });
  // Falls back to BASE_URL when APP_URL is unset — they were read interchangeably.
  withEnv({ NEXT_PUBLIC_APP_URL: undefined, NEXT_PUBLIC_BASE_URL: "https://life-therapy.online" }, () => {
    assert.equal(appBaseUrl(), "https://life-therapy.online");
  });
  // Last-resort default when neither is set.
  withEnv({ NEXT_PUBLIC_APP_URL: undefined, NEXT_PUBLIC_BASE_URL: undefined }, () => {
    assert.equal(appBaseUrl(), "https://life-therapy.co.za");
  });
});
