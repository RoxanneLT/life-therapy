import { withCronRun } from "@/lib/cron/with-cron-run";
import { reconcileCalendar, hasDrift } from "@/lib/calendar-reconcile";
import { logCalendarOp } from "@/lib/calendar-sync-log";

export const maxDuration = 120; // 2 minutes max (Vercel)

/**
 * Scheduled calendar check — REPORT ONLY, permanently.
 *
 * reconcileCalendar cannot write; repairs go through the admin's propose → review →
 * apply flow. A cron that silently "fixed" things is what deleted 50 of a client's real
 * sessions in July 2026, and the ability was removed rather than switched off.
 *
 * Its job now is to notice drift EARLY and name it. The July incident went unseen for
 * twelve days because the logs recorded a bare "missing: 26" and never a client.
 */
async function handler() {
  const result = await reconcileCalendar({ daysAhead: 365 });

  const protectedWrongDay = result.orphaned.filter((o) => !o.deletable).length;
  const driftCount =
    result.mismatched.length +
    result.missing.length +
    result.orphaned.length +
    result.duplicates.length +
    result.onHoliday.length;

  await logCalendarOp({
    operation: "reconcile",
    status: driftCount > 0 ? "partial" : "success",
    metadata: {
      checked: result.checked,
      matched: result.matched,
      mismatched: result.mismatched.length,
      missing: result.missing.length,
      // WHO is eventless, not just how many — a bare count is why a broken series sat
      // unnoticed for twelve days.
      missingByClient: result.missingByClient,
      orphaned: result.orphaned.length,
      protectedWrongDay,
      duplicates: result.duplicates.length,
      onHoliday: result.onHoliday.length,
      errors: result.errors,
    },
  });

  if (hasDrift(result)) {
    await sendDriftAlert(result, protectedWrongDay).catch(console.error);
  }

  // Drift is REPORTED, not failed.
  //
  // This returned the drift count as `failed`, so withCronRun stamped the run —
  // and the daily run that folds these in — as failed on any day the calendar had
  // drift. 144 of 181 runs read "failed" while the job did exactly what it exists
  // to do. A status that is almost always red tells you nothing on the day it
  // matters, which is the same way the July incident stayed invisible for twelve
  // days. The drift alert above is the signal; this number is for the digest.
  return Response.json({ ok: true, observed: driftCount, ...result });
}

async function sendDriftAlert(
  result: Awaited<ReturnType<typeof reconcileCalendar>>,
  protectedWrongDay: number,
) {
  const { sendEmail } = await import("@/lib/email");
  const { getSiteSettings } = await import("@/lib/settings");
  const settings = await getSiteSettings();

  // Lead with WHO, and with the soonest session — that is the number that decides
  // whether this is urgent.
  const byClient = result.missingByClient
    .map((m) => `• ${m.client} — ${m.count} session(s) with no calendar event, next ${m.nextDate}`)
    .join("\n");

  const soonest = result.missingByClient[0];
  const headline = soonest
    ? `${soonest.client} has no calendar event for ${soonest.nextDate}`
    : `${result.orphaned.length + result.duplicates.length} calendar event(s) need review`;

  const protectedNote =
    protectedWrongDay > 0
      ? `<p><strong>${protectedWrongDay} event(s) look like wrong-day sessions.</strong> Do NOT delete these by hand — rebuild the client's series instead, which moves them to the correct day.</p>`
      : "";

  await sendEmail({
    to: settings.email || "hello@life-therapy.co.za",
    subject: `⚠️ Calendar drift: ${headline}`,
    html: `
      <h3>Calendar check — action needed</h3>
      <p>Checked ${result.checked} bookings, ${result.matched} matched.</p>
      ${byClient ? `<h4>Sessions with no calendar event:</h4><pre>${byClient}</pre>` : ""}
      ${result.duplicates.length > 0 ? `<p>${result.duplicates.length} duplicate event(s) in a slot that already has one.</p>` : ""}
      ${result.orphaned.length > 0 ? `<p>${result.orphaned.length} event(s) with no matching booking.</p>` : ""}
      ${result.mismatched.length > 0 ? `<p>${result.mismatched.length} event(s) with the wrong duration.</p>` : ""}
      ${protectedNote}
      <p>Review and approve repairs under <strong>Admin → Settings → Calendar sync</strong>.
      Nothing is changed automatically.</p>
      ${result.errors.length > 0 ? `<h4>Errors:</h4><pre>${result.errors.join("\n")}</pre>` : ""}
    `,
    templateKey: "system_notification",
    skipTracking: true,
  });
}

export const GET = withCronRun("reconcile_calendar", handler);
