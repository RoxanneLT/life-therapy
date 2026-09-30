import { test } from "node:test";
import assert from "node:assert/strict";
import { isWhatsAppHour } from "./quiet-hours";

// SAST is UTC+2: 04:00 SAST is 02:00Z.
test("04:00 SAST — the 2-hourly run before a 07:00 session — is quiet", () => {
  assert.equal(isWhatsAppHour(new Date("2026-09-30T02:00:00Z")), false);
});

test("08:46 SAST — when the daily job runs — may send", () => {
  assert.equal(isWhatsAppHour(new Date("2026-09-30T06:46:00Z")), true);
});

test("06:59 SAST is quiet, 07:00 is not", () => {
  assert.equal(isWhatsAppHour(new Date("2026-09-30T04:59:59Z")), false);
  assert.equal(isWhatsAppHour(new Date("2026-09-30T05:00:00Z")), true);
});

test("20:59 SAST may send, 21:00 may not", () => {
  assert.equal(isWhatsAppHour(new Date("2026-09-30T18:59:59Z")), true);
  assert.equal(isWhatsAppHour(new Date("2026-09-30T19:00:00Z")), false);
});

test("the SAST hour, not the UTC one — 23:30Z is 01:30 SAST the next day", () => {
  assert.equal(isWhatsAppHour(new Date("2026-09-30T23:30:00Z")), false);
});
