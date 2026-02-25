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

interface RescheduleDialogProps {
  bookingId: string;
  sessionType: string;
  currentDate: string;
  currentTime: string;
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
      await rescheduleBooking(bookingId, date, startTime, endTime);
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
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
