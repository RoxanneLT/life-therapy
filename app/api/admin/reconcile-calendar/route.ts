import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { reconcileCalendar } from "@/lib/calendar-reconcile";
import { logCalendarOp } from "@/lib/calendar-sync-log";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    await requireRole("super_admin");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const autoFix = body.autoFix === true;

  const result = await reconcileCalendar({ autoFix, daysAhead: 540 });

  const unresolved =
    result.mismatched.length +
    result.missing.filter((m) => !m.autoFixed).length +
    result.orphaned.length +
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
}
