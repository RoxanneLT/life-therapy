"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, CalendarDays, Clock, User, Mail } from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { createBooking } from "@/app/(public)/book/actions";
import type { BookingData } from "./booking-widget";

interface BookingReviewStepProps {
  readonly data: BookingData;
  readonly onBack: () => void;
}

export function BookingReviewStep({ data, onBack }: BookingReviewStepProps) {
  const [submitting, setSubmitting] = useState(false);

  const dateObj = parse(data.date!, "yyyy-MM-dd", new Date());
  const dateLabel = format(dateObj, "EEEE, d MMMM yyyy");

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("sessionType", data.sessionType!.type);
      formData.set("date", data.date!);
      formData.set("startTime", data.slot!.start);
      formData.set("clientName", data.clientName);
      formData.set("clientEmail", data.clientEmail);
      if (data.clientPhone) formData.set("clientPhone", data.clientPhone);
      if (data.clientNotes) formData.set("clientNotes", data.clientNotes);

      await createBooking(formData);
      // redirect happens in the server action
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Booking failed. Please try again."
      );
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-xl font-bold">
          Confirm Your Booking
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please review the details below and confirm.
        </p>
      </div>

      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{data.sessionType!.label}</CardTitle>
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
              {data.slot!.start} – {data.slot!.end} (
              {data.sessionType!.durationMinutes} min)
            </span>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>{data.clientName}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{data.clientEmail}</span>
          </div>
          {data.clientNotes && (
            <>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">Notes:</span>
                <p className="mt-1 text-sm">{data.clientNotes}</p>
              </div>
            </>
          )}
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-brand-700">
              {data.sessionType!.priceLabel}
            </span>
          </div>
          {data.sessionType!.priceZarCents > 0 && (
            <p className="text-xs text-muted-foreground">
              Payment details will be sent to you after booking.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mx-auto flex max-w-md justify-between pt-2">
        <Button variant="ghost" onClick={onBack} disabled={submitting}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm Booking
        </Button>
      </div>
    </div>
  );
}
