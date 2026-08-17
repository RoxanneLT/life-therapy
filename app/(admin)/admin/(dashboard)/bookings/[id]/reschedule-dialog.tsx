"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CalendarClock } from "lucide-react";
import { ReschedulePicker } from "@/components/booking/reschedule-picker";
import { rescheduleBooking } from "../actions";
import { toast } from "sonner";

interface RescheduleDialogProps {
  readonly bookingId: string;
  readonly sessionType: string;
  readonly currentDate: string;
  readonly currentTime: string;
}

export function RescheduleDialog({
  bookingId,
  sessionType,
  currentDate,
  currentTime,
}: RescheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(date: string, startTime: string, endTime: string) {
    startTransition(async () => {
      try {
        // On success this redirects, which throws NEXT_REDIRECT — so anything
        // that comes BACK is a refusal with a reason worth showing. Previously
        // nothing here read the result or caught anything, so a taken slot was
        // an unexplained failure with the dialog still sitting open.
        const result = await rescheduleBooking(bookingId, date, startTime, endTime);
        if (result && !result.success) {
          toast.error(result.error ?? "Could not reschedule that booking.");
        }
      } catch (err) {
        const digest = (err as { digest?: unknown })?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) throw err;
        toast.error("Could not reschedule that booking — please try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarClock className="mr-2 h-4 w-4" />
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
        </DialogHeader>
        {open && (
          <ReschedulePicker
            sessionType={sessionType}
            currentDate={currentDate}
            currentTime={currentTime}
            onConfirm={handleConfirm}
            isPending={isPending}
            isAdmin
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
