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

  const result = await reconcileCalendar({ autoFix, daysAhead: 90 });

  await logCalendarOp({
    operation: "reconcile",
    status:
      result.mismatched.length > 0 ||
      result.missing.filter((m) => !m.autoFixed).length > 0
        ? "partial"
        : "success",
    metadata: {
      checked: result.checked,
      matched: result.matched,
      mismatched: result.mismatched.length,
      missing: result.missing.length,
      fixed: result.fixed,
      manual: true,
      autoFix,
    },
  });

  return NextResponse.json(result);
}
