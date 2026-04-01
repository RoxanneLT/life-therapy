"use client";

import { useState } from "react";
import { DayView } from "./day-view";
import { WeekView } from "./week-view";
import { CreateBookingDialog } from "./create-booking-dialog";
import type { BusinessHours } from "@/lib/settings";

interface ShellBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  couplesPartnerName: string | null;
  sessionType: string;
  status: string;
  teamsMeetingUrl: string | null;
  adminNotes: string | null;
  studentId: string | null;
}

interface ShellOverride {
  date: string;
  isBlocked: boolean;
  reason: string | null;
}

interface CalendarShellProps {
  view: "day" | "week";
  bookings: ShellBooking[];
  date: string;
  businessHours: BusinessHours | null;
  overrides: ShellOverride[];
}

export function CalendarShell({
  view,
  bookings,
  date,
  businessHours,
  overrides,
}: Readonly<CalendarShellProps>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>();
  const [prefilledTime, setPrefilledTime] = useState<string | undefined>();

  function handleSlotClick(slotDate: string, slotTime: string) {
    setPrefilledDate(slotDate);
    setPrefilledTime(slotTime);
    setDialogOpen(true);
  }

  function handleOpenChange(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setPrefilledDate(undefined);
      setPrefilledTime(undefined);
    }
  }

  return (
    <>
      <CreateBookingDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        prefilledDate={prefilledDate}
        prefilledTime={prefilledTime}
      />
      {view === "day" && (
        <DayView
          bookings={bookings}
          date={date}
          businessHours={businessHours}
          override={overrides[0] ?? null}
          onSlotClick={handleSlotClick}
        />
      )}
      {view === "week" && (
        <WeekView
          bookings={bookings}
          date={date}
          businessHours={businessHours}
          overrides={overrides}
          onSlotClick={handleSlotClick}
        />
      )}
    </>
  );
}
