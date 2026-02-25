"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateBookingSettings(formData: FormData) {
  await requireRole("super_admin");

  const raw = Object.fromEntries(formData.entries());

  const data = {
    bookingEnabled: raw.bookingEnabled === "true",
    bookingMaxAdvanceDays: parseInt(raw.bookingMaxAdvanceDays as string, 10) || 30,
    bookingMinNoticeHours: parseInt(raw.bookingMinNoticeHours as string, 10) || 24,
    bookingBufferMinutes: parseInt(raw.bookingBufferMinutes as string, 10) || 15,
  };

  const existing = await prisma.siteSetting.findFirst();
  if (existing) {
    await prisma.siteSetting.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.siteSetting.create({ data });
  }

  revalidatePath("/admin/bookings/settings");
  revalidatePath("/book");
}
