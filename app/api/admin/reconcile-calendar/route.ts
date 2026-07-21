import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { reconcileCalendar, hasDrift } from "@/lib/calendar-reconcile";
import { logCalendarOp } from "@/lib/calendar-sync-log";

export const maxDuration = 300;

/**
 * Run a calendar check and return the PROPOSED repairs.
 *
 * There is no auto-fix flag any more — not disabled, gone. reconcileCalendar cannot
 * write at all, and repairs are applied by applyCalendarRepairsAction against items the
 * admin explicitly approved and which are re-verified at execution time.
 */
export async function POST() {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await reconcileCalendar({ daysAhead: 365 });

    await logCalendarOp({
      operation: "reconcile",
      status: hasDrift(result) ? "partial" : "success",
      metadata: {
        checked: result.checked,
        matched: result.matched,
        mismatched: result.mismatched.length,
        missing: result.missing.length,
        missingByClient: result.missingByClient,
        orphaned: result.orphaned.length,
        duplicates: result.duplicates.length,
        protectedWrongDay: result.orphaned.filter((o) => !o.deletable).length,
        onHoliday: result.onHoliday.length,
        manual: true,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    // Always return JSON so the client never chokes on an HTML error page
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reconciliation failed" },
      { status: 500 },
    );
  }
}
