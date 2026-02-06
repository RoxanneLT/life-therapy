"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
