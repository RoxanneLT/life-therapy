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
import { renderFallback, escapeTemplateVariables, getSampleData } from "./email-render";
import defaults from "./email-template-defaults";

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

// ── Escaping: the unauthenticated booking form reaches these templates ──────

test("a client-supplied name cannot deliver markup", () => {
  // The public booking form is unauthenticated. `clientName` went straight into
  // the confirmation email AND the practice's notification, so anyone could have
  // a link of their choosing delivered from life-therapy.co.za, over its DKIM
  // signature. That is a phishing email the practice sends for the attacker.
  const evil = '<a href="https://evil.example">Click here to reschedule</a>';
  const safe = escapeTemplateVariables({ clientName: evil });

  assert.ok(!safe.clientName.includes("<a "), "the tag must not survive");
  assert.equal(
    safe.clientName,
    "&lt;a href=&quot;https://evil.example&quot;&gt;Click here to reschedule&lt;/a&gt;",
  );

  // ...and it must still be escaped once it has been through a template.
  const r = renderFallback("booking_confirmation", {
    ...safe,
    sessionType: "Individual Therapy",
    date: "Monday, 10 March 2025",
    time: "10:00 – 11:00 (SAST)",
    duration: "60",
  });
  assert.ok(!/<a href="https:\/\/evil\.example"/.test(r.html), "no live link in the body");
  assert.ok(r.html.includes("&lt;a href="), "the name renders as visible text");
});

test("a registered HTML block passes through untouched", () => {
  // The bypass has to keep working, or every invoice loses its line-item table.
  const table = '<table><tr><td>Individual Session</td><td>R850.00</td></tr></table>';
  const safe = escapeTemplateVariables({ sessionSummary: table, billingName: "Jane & John" });

  assert.equal(safe.sessionSummary, table, "a registered block is not escaped");
  assert.equal(safe.billingName, "Jane &amp; John", "everything else is");
});

test("every sample value that carries markup is a registered raw variable", () => {
  // This is the check that keeps the registry honest as templates grow: a new
  // HTML block added at a call site and NOT registered would be escaped and
  // arrive in the client's inbox as visible tags. Two variables (teamsButton,
  // discountRow) were missing from the first draft of the registry and were
  // caught exactly this way.
  for (const key of Object.keys(defaults)) {
    const sample = getSampleData(key);
    const escaped = escapeTemplateVariables(sample);
    for (const [name, value] of Object.entries(sample)) {
      if (!/<[a-zA-Z/]/.test(value)) continue;
      assert.equal(
        escaped[name],
        value,
        `${key}.${name} carries HTML but is not in RAW_HTML_VARIABLES — it would render as tags`,
      );
    }
  }
});
