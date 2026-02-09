"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { cancelCalendarEvent } from "@/lib/graph";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { format } from "date-fns";
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
    const config = getSessionTypeConfig(booking.sessionType);
    const email = await renderEmail("booking_cancellation", {
      clientName: booking.clientName,
      sessionType: config.label,
      date: format(new Date(booking.date), "EEEE, d MMMM yyyy"),
      time: `${booking.startTime} – ${booking.endTime} (SAST)`,
      bookUrl: "https://life-therapy.co.za/book",
    });
    await sendEmail({ to: booking.clientEmail, ...email, templateKey: "booking_cancellation", metadata: { bookingId: id } }).catch(console.error);
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
