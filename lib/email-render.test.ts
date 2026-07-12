/**
 * Email fallback templates — the path that only runs when something is wrong.
 *
 * `renderEmail()` prefers the DB template and falls back to `renderFallback()`.
 * That means the fallback is invisible in normal operation: four keys
 * (`booking_cancellation`, `booking_notification`, `booking_reminder`,
 * `order_confirmation`) had NO case at all and nobody noticed, because the seeded
 * DB templates masked it. Had an admin toggled one to inactive, real clients would
 * have received subject "Email: booking_cancellation", body "Template not found."
 * — and `sendEmail()` would still have reported SUCCESS.
 *
 * These fixtures render the fallback DIRECTLY, so the failure path is exercised on
 * every run instead of only in the incident.
 *
 * The variable sets below are exactly what the call sites pass. If you add a
 * variable at a call site and not here, the fallback silently renders a blank —
 * so these tests are also the contract between the two.
 *
 * Run: npm run test:email  (part of `npm run check`)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderFallback } from "./email-render";

/** A fallback is "broken" if it fell through to the default: arm. */
function assertRendered(key: string, r: { subject: string; html: string }) {
  assert.ok(
    !/Template not found/i.test(r.html),
    `${key} fell through to default: — the client would receive "Template not found."`,
  );
  assert.ok(
    !r.subject.startsWith("Email: "),
    `${key} fell through to default: — subject was the raw key`,
  );
  assert.ok(r.html.length > 200, `${key} rendered a suspiciously empty body`);
}

test("booking_cancellation renders for the client", () => {
  const r = renderFallback("booking_cancellation", {
    clientName: "Angela Gohre",
    sessionType: "1:1 Individual Session",
    date: "Tuesday, 8 July 2026",
    time: "14:15 - 15:15 (SAST)",
    bookUrl: "https://life-therapy.co.za/book",
  });
  assertRendered("booking_cancellation", r);
  assert.match(r.subject, /Cancelled/i);
  for (const s of ["Angela Gohre", "14:15", "Tuesday, 8 July 2026", "/book"]) {
    assert.ok(r.html.includes(s), `body must carry ${s}`);
  }
});

test("booking_reminder renders, and carries the Teams button through", () => {
  const teamsButton = '<a href="https://teams.microsoft.com/x">Join Microsoft Teams Meeting</a>';
  const r = renderFallback("booking_reminder", {
    clientName: "Lisa Toms",
    sessionType: "Couples Session",
    date: "Wednesday, 8 July 2026",
    time: "09:00 - 10:00 (SAST)",
    startTime: "09:00",
    teamsButton, // the call site pre-renders this HTML block
  });
  assertRendered("booking_reminder", r);
  assert.ok(r.html.includes("Lisa Toms"));
  assert.ok(r.html.includes(teamsButton), "the pre-rendered Teams block must survive");
});

test("booking_notification renders for the practice inbox (not the client)", () => {
  const r = renderFallback("booking_notification", {
    sessionType: "1:1 Individual Session",
    clientName: "Andrea Behnsen",
    date: "Wednesday, 8 July 2026",
    time: "10:15 - 11:15",
    duration: "60",
    clientDetails: "<p><strong>Email:</strong> andrea@example.com</p>",
    teamsLink: "<p>Teams link: https://teams.microsoft.com/x</p>",
  });
  assertRendered("booking_notification", r);
  assert.ok(r.html.includes("Andrea Behnsen"));
  assert.ok(r.html.includes("60"), "duration must appear");
  assert.ok(r.html.includes("andrea@example.com"), "the client-details block must survive");
});

test("order_confirmation renders, with the items table and totals", () => {
  const r = renderFallback("order_confirmation", {
    firstName: "Sam",
    orderNumber: "LT-20260712-0007",
    orderDate: "12 July 2026",
    orderItemsTable: "<table><tr><td>Foundations Course</td></tr></table>",
    subtotal: "R850,00",
    discountRow: "",
    total: "R850,00",
    portalUrl: "https://life-therapy.co.za/portal",
  });
  assertRendered("order_confirmation", r);
  assert.ok(r.subject.includes("LT-20260712-0007"));
  assert.ok(r.html.includes("Foundations Course"), "the items table must survive");
  assert.ok(r.html.includes("R850,00"), "the total must appear");
  assert.ok(r.html.includes("/portal"), "the portal CTA must appear");
});

test("a genuinely unknown key still degrades safely", () => {
  // The default: arm must remain — it is correct for a key nobody has written a
  // template for. What was wrong was four KNOWN keys landing on it.
  const r = renderFallback("some_key_that_does_not_exist", {});
  assert.match(r.subject, /^Email: /);
  assert.match(r.html, /Template not found/i);
});

test("a missing variable renders blank, never the literal 'undefined'", () => {
  // Every case guards with `|| ""`. Losing that would print "undefined" into a
  // client's email — which looks broken and is impossible to un-send.
  const r = renderFallback("booking_cancellation", {});
  assertRendered("booking_cancellation", r);
  assert.ok(!/undefined/.test(r.html), "no variable may render as the string 'undefined'");
});
