import { withCronRun } from "@/lib/cron/with-cron-run";
import { reconcileCalendar } from "@/lib/calendar-reconcile";
import { logCalendarOp } from "@/lib/calendar-sync-log";

export const maxDuration = 120; // 2 minutes max (Vercel)

async function handler() {
  const result = await reconcileCalendar({
    // GATED OFF 2026-07-21 — the reverse pass deletes recurring-series occurrences it
    // will never recreate, and the day-of-week bug made every wrong-day occurrence look
    // like a ghost. A manual autoFix run deleted 50 of Chanene Norman's real events.
    // Keep check-only until the day-of-week fix is deployed AND the reverse-pass gets a
    // recurring guard. See docs/CALENDAR_SYNC_HANDOVER_2026-07-21.md (bug #5).
    autoFix: false,
    daysAhead: 365, // check the full booking horizon
  });

  const unfixedMissing = result.missing.filter((m) => !m.autoFixed);
  const unresolvedOrphans = result.orphaned.filter((o) => !o.deleted);
  const driftCount =
    result.mismatched.length +
    unfixedMissing.length +
    unresolvedOrphans.length +
    result.onHoliday.length;

  await logCalendarOp({
    operation: "reconcile",
    status: driftCount > 0 ? "partial" : "success",
    metadata: {
      checked: result.checked,
      matched: result.matched,
      mismatched: result.mismatched.length,
      missing: result.missing.length,
      // WHO is eventless, not just how many — a bare count is why Mia Pretorius's
      // series sat broken for twelve days before anyone noticed.
      missingByClient: result.missingByClient,
      orphaned: result.orphaned.length,
      protectedWrongDay: result.orphaned.filter((o) => o.protectedWrongDay).length,
      onHoliday: result.onHoliday.length,
      fixed: result.fixed,
      errors: result.errors,
    },
  });

  // Send an immediate alert email if there are unfixed issues
  if (driftCount > 0) {
    try {
      const { sendEmail } = await import("@/lib/email");
      const { getSiteSettings } = await import("@/lib/settings");
      const settings = await getSiteSettings();

      const mismatchList = result.mismatched
        .map(
          (m) =>
            `• ${m.clientName} on ${m.bookingDate}: booking says ${m.bookingTime}, Outlook says ${m.outlookDate} ${m.outlookTime}`,
        )
        .join("\n");

      const missingList = unfixedMissing
        .map((m) => `• ${m.clientName} on ${m.date} at ${m.time} (${m.reason})`)
        .join("\n");

      const orphanList = unresolvedOrphans
        .map((o) => `• ${o.subject} — ${o.date}`)
        .join("\n");

      const holidayList = result.onHoliday
        .map((h) => `• ${h.clientName} on ${h.date} at ${h.time}`)
        .join("\n");

      const ghostsDeleted = result.orphaned.filter((o) => o.deleted).length;

      await sendEmail({
        to: settings.email || "hello@life-therapy.co.za",
        subject: `⚠️ Calendar sync: ${result.mismatched.length} mismatched, ${unfixedMissing.length} missing, ${unresolvedOrphans.length} stale`,
        html: `
          <h3>Calendar Reconciliation Report</h3>
          <p>Checked ${result.checked} bookings, ${result.matched} matched, ${result.fixed} auto-fixed (incl. ${ghostsDeleted} ghost event(s) deleted).</p>
          ${mismatchList ? `<h4>Mismatched (wrong date/time in Outlook):</h4><pre>${mismatchList}</pre>` : ""}
          ${missingList ? `<h4>Missing from Outlook (could not auto-fix):</h4><pre>${missingList}</pre>` : ""}
          ${orphanList ? `<h4>Stale / wrong events still in Outlook (no matching booking):</h4><pre>${orphanList}</pre>` : ""}
          ${holidayList ? `<h4>Bookings on public holidays (should not exist):</h4><pre>${holidayList}</pre>` : ""}
          ${result.errors.length > 0 ? `<h4>Errors:</h4><pre>${result.errors.join("\n")}</pre>` : ""}
        `,
        templateKey: "system_notification",
        skipTracking: true,
      }).catch(console.error);
    } catch {
      // Email failure shouldn't break the cron
    }
  }

  // `failed` lets withCronRun mark this run as failed when there is drift
  return Response.json({ ok: true, failed: driftCount, ...result });
}

export const GET = withCronRun("reconcile_calendar", handler);
