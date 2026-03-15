"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFreeBusy } from "@/lib/graph";
import { fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/booking-config";

export async function createAvailabilityOverride(formData: FormData) {
  await requireRole("super_admin");

  const raw = Object.fromEntries(formData.entries());
  const isBlocked = raw.isBlocked === "true";

  await prisma.availabilityOverride.upsert({
    where: { date: new Date(raw.date as string) },
    update: {
      isBlocked,
      startTime: isBlocked ? null : (raw.startTime as string) || null,
      endTime: isBlocked ? null : (raw.endTime as string) || null,
      reason: (raw.reason as string) || null,
    },
    create: {
      date: new Date(raw.date as string),
      isBlocked,
      startTime: isBlocked ? null : (raw.startTime as string) || null,
      endTime: isBlocked ? null : (raw.endTime as string) || null,
      reason: (raw.reason as string) || null,
    },
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

  const dateUtc = new Date(`${dateStr}T00:00:00Z`);

  // 1. Availability override
  const override = await prisma.availabilityOverride.findUnique({
    where: { date: dateUtc },
  });

  // 2. Graph calendar busy times
  const dayStartUtc = fromZonedTime(`${dateStr}T00:00:00`, TIMEZONE);
  const dayEndUtc = fromZonedTime(`${dateStr}T23:59:59`, TIMEZONE);
  const busyTimes = await getFreeBusy(dayStartUtc, dayEndUtc);

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
    graphBusyTimes: busyTimes,
    dbBookings: bookings,
    graphQueryWindow: {
      start: dayStartUtc.toISOString(),
      end: dayEndUtc.toISOString(),
    },
  };
}
