export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { format } from "date-fns";
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
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Confirmed",
};

interface Props {
  readonly searchParams: { id?: string };
}

export default async function BookingConfirmationPage({
  searchParams,
}: Props) {
  if (!searchParams.id) notFound();

  const booking = await prisma.booking.findUnique({
    where: { id: searchParams.id },
  });

  if (!booking) notFound();

  const config = getSessionTypeConfig(booking.sessionType);
  const dateLabel = format(new Date(booking.date), "EEEE, d MMMM yyyy");

  return (
    <section className="container mx-auto max-w-2xl px-4 py-16">
      <div className="text-center">
        <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
        <h1 className="mt-4 font-heading text-3xl font-bold">
          Booking Confirmed!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Thank you, {booking.clientName}. A confirmation email has been sent to{" "}
          <strong>{booking.clientEmail}</strong>.
        </p>
      </div>

      <Card className="mt-8">
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
                : `R${(booking.priceZarCents / 100).toLocaleString()}`}
            </span>
          </div>
          {booking.priceZarCents > 0 && (
            <p className="text-xs text-muted-foreground">
              Payment details will be sent to you separately.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-8 space-y-4 rounded-lg bg-muted/50 p-6">
        <h3 className="font-heading text-lg font-semibold">
          What to expect
        </h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            You&rsquo;ll receive a confirmation email with your session details
            and meeting link.
          </li>
          <li>
            A reminder will be sent 24 hours before your session.
          </li>
          <li>
            Please join the meeting link a few minutes early and ensure your
            audio/video is working.
          </li>
          <li>
            If you need to reschedule or cancel, please contact us at least 24
            hours in advance.
          </li>
        </ul>
      </div>

      <div className="mt-8 text-center">
        <Link href="/">
          <Button variant="outline">Back to Homepage</Button>
        </Link>
      </div>
    </section>
  );
}
