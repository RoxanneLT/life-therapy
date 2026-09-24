"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFreeBusy } from "@/lib/graph";
import { parseSlotStartTimes } from "@/lib/booking-config";
import { saDayStart, saDayEnd, calendarDate } from "@/lib/dates";

/**
 * Three shapes of override, one row.
 *
 *   blocked — the day is shut. What the switch did before today.
 *   hours   — the day runs to a custom open/close window.
 *   slots   — only the ticked slot start times are open; everything else on the day is shut.
 *
 * `openSlots` empty means the whole day, so a row written before the column existed and a row
 * saying "open the whole day" are the same row. That is why there is no fourth mode flag stored:
 * the shape is readable from the row, and a stored mode could disagree with the values beside it.
 */
export async function createAvailabilityOverride(formData: FormData) {
  await requireRole("super_admin");

  const raw = Object.fromEntries(formData.entries());
  const mode = raw.mode === "hours" || raw.mode === "slots" ? raw.mode : "blocked";
  const isBlocked = mode === "blocked";

  // Never the request's own strings: parseSlotStartTimes keeps only times the system actually
  // starts a slot at. A time it does not know is dropped, so the refusal below is what the admin
  // sees rather than a day that silently opens to nothing.
  const openSlots = mode === "slots" ? parseSlotStartTimes(String(raw.openSlots ?? "")) : [];

  if (mode === "slots" && openSlots.length === 0) {
    return { error: "Pick at least one time slot to open, or choose a different option." };
  }

  const fields = {
    isBlocked,
    startTime: mode === "hours" ? (raw.startTime as string) || null : null,
    endTime: mode === "hours" ? (raw.endTime as string) || null : null,
    openSlots,
    reason: (raw.reason as string) || null,
  };

  await prisma.availabilityOverride.upsert({
    where: { date: new Date(raw.date as string) },
    update: fields,
    create: { date: new Date(raw.date as string), ...fields },
  });

  revalidatePath("/admin/bookings/availability");
  redirect("/admin/bookings/availability");
}

export async function deleteAvailabilityOverride(id: string) {
  await requireRole("super_admin");
  await prisma.availabilityOverride.delete({ where: { id } });
  revalidatePath("/admin/bookings/availability");
}

/** Debug: show what's blocking slots for a given date */
export async function debugAvailability(dateStr: string) {
  await requireRole("super_admin");

  const dateUtc = calendarDate(dateStr);

  // 1. Availability override
  const override = await prisma.availabilityOverride.findUnique({
    where: { date: dateUtc },
  });

  // 2. Graph calendar busy times
  const dayStartUtc = saDayStart(dateStr);
  const dayEndUtc = saDayEnd(dateStr);
  const { slots: busySlots, failed: freeBusyFailed } = await getFreeBusy(dayStartUtc, dayEndUtc);

  // 3. Existing DB bookings
  const bookings = await prisma.booking.findMany({
    where: {
      date: dateUtc,
      status: { in: ["pending", "confirmed"] },
    },
    select: { id: true, startTime: true, endTime: true, status: true, sessionType: true },
  });

  return {
    date: dateStr,
    override: override ? { isBlocked: override.isBlocked, startTime: override.startTime, endTime: override.endTime, reason: override.reason } : null,
    graphBusyTimes: busySlots,
    freeBusyFailed,
    dbBookings: bookings,
    graphQueryWindow: {
      start: dayStartUtc.toISOString(),
      end: dayEndUtc.toISOString(),
    },
  };
}
