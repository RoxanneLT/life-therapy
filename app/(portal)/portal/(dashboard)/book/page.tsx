export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";
import { getCurrency } from "@/lib/get-region";
import { getSessionPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PortalBookingWidget } from "./portal-booking-widget";

export default async function PortalBookPage() {
  const { student } = await requirePasswordChanged();

  const [settings, balanceRecord, partnerRelationship, existingFreeConsultation] = await Promise.all([
    getSiteSettings(),
    prisma.sessionCreditBalance.findUnique({
      where: { studentId: student.id },
    }),
    prisma.clientRelationship.findFirst({
      where: {
        studentId: student.id,
        relationshipType: "partner",
      },
      include: {
        relatedStudent: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.booking.findFirst({
      where: { studentId: student.id, sessionType: "free_consultation" },
      select: { id: true },
    }),
  ]);

  const creditBalance = balanceRecord?.balance ?? 0;
  const currency = await getCurrency();

  const sessionPrices: Record<string, number> = {
    free_consultation: 0,
    individual: getSessionPrice("individual", currency, settings),
    couples: getSessionPrice("couples", currency, settings),
  };

  const partner = partnerRelationship?.relatedStudent
    ? {
        name: `${partnerRelationship.relatedStudent.firstName} ${partnerRelationship.relatedStudent.lastName || ""}`.trim(),
        email: partnerRelationship.relatedStudent.email,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/portal/bookings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-bold">Book a Session</h1>
      </div>
      <PortalBookingWidget
        creditBalance={creditBalance}
        sessionPrices={sessionPrices}
        currency={currency}
        studentName={`${student.firstName} ${student.lastName || ""}`.trim()}
        studentEmail={student.email}
        partner={partner}
        hideFreeConsultation={!!existingFreeConsultation}
      />
    </div>
  );
}
