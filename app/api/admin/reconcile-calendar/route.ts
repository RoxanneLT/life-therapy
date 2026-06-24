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
    const autoFix = body.autoFix === true;

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
