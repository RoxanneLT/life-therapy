import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { reconcileCalendar } from "@/lib/calendar-reconcile";
import { logCalendarOp } from "@/lib/calendar-sync-log";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const requestedAutoFix = body.autoFix === true;

    // TEMPORARY SAFETY GATE (2026-07-21) — auto-fix is disabled SERVER-SIDE, so the flag
    // is ignored no matter which browser/tab sends it. The reconcile reverse pass deletes
    // recurring-series occurrences it never recreates; a manual auto-fix run deleted 50 of
    // a client's real events. Re-enable (remove this gate) ONLY after the day-of-week fix
    // is deployed AND the reverse pass has a recurring guard. Check-only still works.
    // See docs/CALENDAR_SYNC_HANDOVER_2026-07-21.md (bugs #1, #5).
    const AUTOFIX_DISABLED = true;
    const autoFix = requestedAutoFix && !AUTOFIX_DISABLED;

    const result = await reconcileCalendar({ autoFix, daysAhead: 365 });

    const unresolved =
      result.mismatched.length +
      result.missing.filter((m) => !m.autoFixed).length +
      result.orphaned.filter((o) => !o.deleted).length +
      result.onHoliday.length;

    await logCalendarOp({
      operation: "reconcile",
      status: unresolved > 0 ? "partial" : "success",
      metadata: {
        checked: result.checked,
        matched: result.matched,
        mismatched: result.mismatched.length,
        missing: result.missing.length,
        orphaned: result.orphaned.length,
        onHoliday: result.onHoliday.length,
        fixed: result.fixed,
        manual: true,
        autoFix,
        autoFixRequested: requestedAutoFix,
      },
    });

    return NextResponse.json({
      ...result,
      // Tell the UI the button ran check-only despite the request, so it can say so.
      autoFixDisabled: requestedAutoFix && AUTOFIX_DISABLED,
    });
  } catch (error) {
    // Always return JSON so the client never chokes on an HTML error page
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 500 },
    );
  }
}
