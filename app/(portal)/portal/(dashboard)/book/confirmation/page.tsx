export const dynamic = "force-dynamic";

import { requirePasswordChanged } from "@/lib/student-auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import type { Currency } from "@/lib/region";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CheckCircle, CalendarDays, Clock, Video } from "lucide-react";

interface Props {
  readonly searchParams: Promise<{ token?: string }>;
}

export default async function PortalBookingConfirmationPage({
  searchParams,
}: Props) {
  await requirePasswordChanged();
  const { token } = await searchParams;
  if (!token) notFound();

  const booking = await prisma.booking.findUnique({
    where: { confirmationToken: token },
  });

  if (!booking) notFound();

  const config = getSessionTypeConfig(booking.sessionType);
  const dateLabel = format(new Date(booking.date), "EEEE, d MMMM yyyy");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 font-heading text-3xl font-bold">
          Booking Confirmed!
        </h1>
        <p className="mt-2 text-muted-foreground">
          A confirmation email has been sent to{" "}
          <strong>{booking.clientEmail}</strong>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{config.label}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span>{dateLabel}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>
              {booking.startTime} – {booking.endTime} (
              {booking.durationMinutes} min)
            </span>
          </div>
          {booking.teamsMeetingUrl && (
            <>
              <Separator />
              <div className="flex items-center gap-3">
                <Video className="h-4 w-4 text-muted-foreground" />
                <a
                  href={booking.teamsMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline break-all"
                >
                  Join Microsoft Teams Meeting
                </a>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>
              {booking.priceZarCents === 0
                ? "Free"
                : formatPrice(booking.priceZarCents, (booking.priceCurrency || "ZAR") as Currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center gap-3">
        <Button asChild>
          <Link href="/portal/bookings">View My Sessions</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/portal">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
