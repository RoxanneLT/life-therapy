/**
 * Cron authentication — the shapes that must work, and the one that must not.
 *
 * The scheduled callers are the spec here, so they are named explicitly. If someone
 * "tidies up" the header handling, this file is what tells them cPanel is on
 * `x-cron-secret` and Vercel is on `Authorization: Bearer` — before production
 * finds out at 06:00.
 *
 * Run: npm run test:cron  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCronAuthorised } from "./with-cron-run";
import { isIssue } from "./cron-digest";

// isCronAuthorised reads process.env at CALL time, not module load, so setting it
// here is enough — and it's what lets the fail-closed test below delete it safely.
process.env.CRON_SECRET = "s3cr3t-value";

/** Minimal NextRequest stand-in: isCronAuthorised only touches .headers and .url. */
function req(opts: { headers?: Record<string, string>; url?: string }) {
  return {
    headers: { get: (k: string) => opts.headers?.[k.toLowerCase()] ?? null },
    url: opts.url ?? "https://life-therapy.co.za/api/cron/gift-delivery",
  } as never;
}

test("the cPanel cron call authorises (x-cron-secret header)", () => {
  // This is the live crontab shape:
  //   curl -s -m 110 -o /dev/null -H "x-cron-secret: $SECRET" https://…/api/cron/gift-delivery
  assert.equal(isCronAuthorised(req({ headers: { "x-cron-secret": "s3cr3t-value" } })), true);
});

test("the Vercel Cron call authorises (Authorization: Bearer)", () => {
  // vercel.json schedules /api/cron/daily; Vercel sends the secret as a Bearer token.
  assert.equal(isCronAuthorised(req({ headers: { authorization: "Bearer s3cr3t-value" } })), true);
});

test("the secret is REJECTED from the query string", () => {
  // Removed deliberately: a credential in a URL is written to Vercel's access logs,
  // kept in browser history, and leaked in the Referer of any outbound request.
  // Neither scheduled caller ever used this form.
  assert.equal(
    isCronAuthorised(req({ url: "https://life-therapy.co.za/api/cron/daily?secret=s3cr3t-value" })),
    false,
  );
});

test("a wrong or absent credential is rejected", () => {
  assert.equal(isCronAuthorised(req({ headers: { "x-cron-secret": "wrong" } })), false);
  assert.equal(isCronAuthorised(req({ headers: { authorization: "Bearer wrong" } })), false);
  assert.equal(isCronAuthorised(req({})), false);
  // Same length as the real secret — exercises the timing-safe compare rather than
  // the length short-circuit.
  assert.equal(isCronAuthorised(req({ headers: { "x-cron-secret": "s3cr3t-valuX" } })), false);
});

test("an unset CRON_SECRET fails CLOSED, not open", () => {
  // If the env var is missing, nothing is authorised. The alternative — treating
  // undefined as a match — would leave every cron endpoint world-callable.
  const saved = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    assert.equal(isCronAuthorised(req({ headers: { "x-cron-secret": "anything" } })), false);
    assert.equal(isCronAuthorised(req({})), false);
  } finally {
    process.env.CRON_SECRET = saved;
  }
});

// ── What counts as a failure, and what merely counts ────────────────────────

test("a job that NOTICED something has not failed", () => {
  // The distinction this encodes: `failed` is work a job tried and could not do;
  // `observed` is something it looked for and found. reconcile_calendar returned
  // its drift count as `failed`, so 144 of its 181 runs read "failed" while doing
  // exactly its job — and a status that is red almost every day cannot tell you
  // about the day that matters.
  assert.equal(isIssue({ status: "ok", observed: 12 }), true, "drift still reaches the digest");
  assert.equal(isIssue({ status: "ok", failed: 0, observed: 12 }), true);

  // ...but it is not the job failing, which is what the run status records.
  assert.equal(isIssue({ status: "ok" }), false);
  assert.equal(isIssue({ status: "ok", observed: 0 }), false);
});

test("a job that could not do its work still fails", () => {
  assert.equal(isIssue({ status: "ok", failed: 3 }), true);
  assert.equal(isIssue({ status: "error", error: "boom" }), true);
  assert.equal(isIssue({ status: "partial" }), true);
});
