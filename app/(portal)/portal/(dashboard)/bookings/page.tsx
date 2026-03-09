export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { BookingsClient } from "./bookings-client";
import { getSiteSettings } from "@/lib/settings";
import { getSessionPrice } from "@/lib/pricing";
import Link from "next/link";

export default async function PortalBookingsPage() {
  const { student } = await requirePasswordChanged();
  const settings = await getSiteSettings();
  const sessionRates: Record<string, number> = {
    individual: getSessionPrice("individual", "ZAR", settings),
    couples: getSessionPrice("couples", "ZAR", settings),
    free_consultation: 0,
  };

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
      sessionMode: true,
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
      clientNotes: true,
      policyOverride: true,
    },
  });

  // Serialize dates for client component (explicit fields to strip Prisma symbols)
  const serialized = bookings.map((b) => ({
    id: b.id,
    sessionType: b.sessionType,
    sessionMode: b.sessionMode,
    date: b.date.toISOString().slice(0, 10),
    startTime: b.startTime,
    endTime: b.endTime,
    durationMinutes: b.durationMinutes,
    status: b.status,
    teamsMeetingUrl: b.teamsMeetingUrl,
    rescheduleCount: b.rescheduleCount,
    rescheduledAt: b.rescheduledAt?.toISOString() || null,
    originalDate: b.originalDate ? b.originalDate.toISOString().slice(0, 10) : null,
    originalStartTime: b.originalStartTime,
    cancelledBy: b.cancelledBy,
    cancellationReason: b.cancellationReason,
    creditRefunded: b.creditRefunded,
    isLateCancel: b.isLateCancel,
    cancelledAt: b.cancelledAt?.toISOString() || null,
    clientNotes: b.clientNotes || null,
    policyOverride: b.policyOverride,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">My Sessions</h1>
        <Link
          href="/portal/book"
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          + Book a Session
        </Link>
      </div>
      <BookingsClient bookings={serialized} billingType={student.billingType} sessionRates={sessionRates} />
    </div>
  );
}
