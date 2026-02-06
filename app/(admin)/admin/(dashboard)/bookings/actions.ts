"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { cancelCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { bookingCancellationEmail } from "@/lib/email-templates";
import type { BookingStatus } from "@/lib/generated/prisma/client";

export async function updateBookingStatus(id: string, status: BookingStatus) {
  await requireRole("super_admin", "editor");

  const booking = await prisma.booking.update({
    where: { id },
    data: { status },
  });

  if (status === "cancelled") {
    if (booking.graphEventId) {
      await cancelCalendarEvent(booking.graphEventId).catch(console.error);
    }
    const email = bookingCancellationEmail(booking);
    await sendEmail({ to: booking.clientEmail, ...email }).catch(console.error);
  }

  revalidatePath("/admin/bookings");
  revalidatePath(`/admin/bookings/${id}`);
}

export async function updateBookingNotes(id: string, formData: FormData) {
  await requireRole("super_admin", "editor");

  const adminNotes = formData.get("adminNotes") as string;
  await prisma.booking.update({
    where: { id },
    data: { adminNotes },
  });

  revalidatePath(`/admin/bookings/${id}`);
}

export async function deleteBooking(id: string) {
  await requireRole("super_admin");

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (booking?.graphEventId) {
    await cancelCalendarEvent(booking.graphEventId).catch(console.error);
  }

  await prisma.booking.delete({ where: { id } });
  revalidatePath("/admin/bookings");
}
