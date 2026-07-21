/**
 * Pin the process timezone for tests. Import this FIRST in any test that exercises the
 * booking → Graph payload path.
 *
 * Why: `buildRecurrence` parses `startDateTime` — a naive SAST wall-clock string like
 * "2026-08-11T09:00:00" — with `new Date()`, which resolves it in the SERVER's timezone.
 * Under UTC (Vercel) and SAST (the business) that lands on the intended day, so
 * production and local dev are correct. Under a far-east zone such as Pacific/Auckland
 * the same string resolves to the PREVIOUS UTC day, and every weekday assertion flips.
 *
 * That sensitivity is a real (documented, latent) property of the parse — not a test
 * bug — but an unpinned suite would let a stray CI timezone produce a false red, or
 * worse a false green. Pinning to UTC makes the suite deterministic AND matches the
 * environment production actually runs in.
 *
 * Set at runtime rather than via a `TZ=` script prefix because that prefix is ignored
 * for IANA names on Windows, where this repo is developed. Node honours a runtime
 * reassignment of process.env.TZ (verified: it changes naive Date parsing).
 *
 * The proper fix is to stop parsing wall-clock strings in the ambient timezone; until
 * that lands, this keeps the tests honest. See lib/graph-payloads.ts.
 */
process.env.TZ = "UTC";

export {};
