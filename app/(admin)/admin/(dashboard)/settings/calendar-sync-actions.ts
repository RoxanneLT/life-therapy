"use server";

import { requireRole } from "@/lib/auth";
import { applyCalendarRepairs } from "@/lib/calendar-apply";
import { revalidatePath } from "next/cache";
import type { RepairItem } from "@/lib/calendar-classify";
import type { ApplyResult } from "@/lib/calendar-apply";

/**
 * Apply the calendar repairs an admin ticked and confirmed.
 *
 * Takes the SPECIFIC items approved — never a "fix everything" flag. Each one is
 * re-verified against freshly-read state inside applyCalendarRepairs before anything is
 * touched, so an approval that has gone stale is skipped and reported rather than forced.
 */
export async function applyCalendarRepairsAction(
  items: RepairItem[],
): Promise<ApplyResult> {
  const { adminUser } = await requireRole("super_admin");

  const result = await applyCalendarRepairs(items, adminUser.email);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/bookings");
  return result;
}
