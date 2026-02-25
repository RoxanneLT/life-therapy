export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { BookingsClient } from "./bookings-client";

export default async function PortalBookingsPage() {
  const { student } = await requirePasswordChanged();

  const bookings = await prisma.booking.findMany({
    where: { studentId: student.id },
    orderBy: { date: "desc" },
    select: {
      id: true,
      sessionType: true,
      date: true,
      startTime: true,
      endTime: true,
      durationMinutes: true,
      status: true,
      teamsMeetingUrl: true,
      rescheduleCount: true,
      rescheduledAt: true,
      originalDate: true,
      originalStartTime: true,
      cancelledBy: true,
      cancellationReason: true,
      creditRefunded: true,
      isLateCancel: true,
      cancelledAt: true,
    },
  });

  // Serialize dates for client component
  const serialized = bookings.map((b) => ({
    ...b,
    date: b.date.toISOString().slice(0, 10),
    rescheduledAt: b.rescheduledAt?.toISOString() || null,
    originalDate: b.originalDate ? b.originalDate.toISOString().slice(0, 10) : null,
    cancelledAt: b.cancelledAt?.toISOString() || null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold">My Sessions</h1>
      <BookingsClient bookings={serialized} />
    </div>
  );
}
