import { NextRequest, NextResponse } from "next/server";
import { reconcileCalendar } from "@/lib/calendar-reconcile";
import { logCalendarOp } from "@/lib/calendar-sync-log";

export const maxDuration = 120; // 2 minutes max (Vercel)

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reconcileCalendar({
    autoFix: true, // auto-create missing events
    daysAhead: 60, // check next 60 days
  });

  const unfixedMissing = result.missing.filter((m) => !m.autoFixed);

  await logCalendarOp({
    operation: "reconcile",
    status:
      result.mismatched.length > 0 || unfixedMissing.length > 0
        ? "partial"
        : "success",
    metadata: {
      checked: result.checked,
      matched: result.matched,
      mismatched: result.mismatched.length,
      missing: result.missing.length,
      fixed: result.fixed,
      errors: result.errors,
    },
  });

  // Send alert email if there are unfixed issues
  if (result.mismatched.length > 0 || unfixedMissing.length > 0) {
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

      await sendEmail({
        to: settings.email || "hello@life-therapy.co.za",
        subject: `⚠️ Calendar sync: ${result.mismatched.length} mismatched, ${unfixedMissing.length} missing`,
        html: `
          <h3>Calendar Reconciliation Report</h3>
          <p>Checked ${result.checked} bookings, ${result.matched} matched, ${result.fixed} auto-fixed.</p>
          ${mismatchList ? `<h4>Mismatched (wrong date/time in Outlook):</h4><pre>${mismatchList}</pre>` : ""}
          ${missingList ? `<h4>Missing from Outlook (could not auto-fix):</h4><pre>${missingList}</pre>` : ""}
          ${result.errors.length > 0 ? `<h4>Errors:</h4><pre>${result.errors.join("\n")}</pre>` : ""}
        `,
        templateKey: "system_notification",
        skipTracking: true,
      }).catch(console.error);
    } catch {
      // Email failure shouldn't break the cron
    }
  }

  return NextResponse.json(result);
}
