import { withCronRun } from "@/lib/cron/with-cron-run";
import { reconcileCalendar } from "@/lib/calendar-reconcile";
import { logCalendarOp } from "@/lib/calendar-sync-log";

export const maxDuration = 120; // 2 minutes max (Vercel)

async function handler() {
  const result = await reconcileCalendar({
    autoFix: true, // auto-create missing events
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
      orphaned: result.orphaned.length,
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
