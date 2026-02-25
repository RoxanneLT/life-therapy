"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isBefore,
  startOfDay,
} from "date-fns";
import { cn } from "@/lib/utils";

interface Slot {
  start: string;
  end: string;
}

interface ReschedulePickerProps {
  sessionType: string;
  currentDate: string;
  currentTime: string;
  onConfirm: (date: string, startTime: string, endTime: string) => void;
  isPending: boolean;
  /** "reschedule" (default) or "new" — controls header/confirm labels */
  mode?: "reschedule" | "new";
}

export function ReschedulePicker({
  sessionType,
  currentDate,
  currentTime,
  onConfirm,
  isPending,
  mode = "reschedule",
}: ReschedulePickerProps) {
  const [month, setMonth] = useState(new Date());
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const fetchDates = useCallback(async () => {
    setLoadingDates(true);
    try {
      const res = await fetch(`/api/booking/available-dates?type=${sessionType}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableDates(new Set(data.dates || []));
      }
    } finally {
      setLoadingDates(false);
    }
  }, [sessionType]);

  useEffect(() => {
    fetchDates();
  }, [fetchDates]);

  /** Reset selections when parent re-mounts (e.g. dialog re-open). */
  useEffect(() => {
    setSelectedDate("");
    setSelectedSlot(null);
    setSlots([]);
  }, []);

  async function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setLoadingSlots(true);
    setSlots([]);
    try {
      const res = await fetch(
        `/api/booking/available-slots?type=${sessionType}&date=${dateStr}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data.slots || []);
      }
    } finally {
      setLoadingSlots(false);
    }
  }

  // Calendar grid
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const today = startOfDay(new Date());

  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const showConfirm = selectedSlot && selectedDate;

  return (
    <>
      {currentDate && currentTime && (
        <p className="mb-3 text-sm text-muted-foreground">
          Currently: {currentDate} at {currentTime}
        </p>
      )}

      {loadingDates ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading availability...
        </div>
      ) : (
        <div className="flex gap-6">
          {/* Left: Month calendar */}
          <div className="w-[280px] shrink-0">
            {/* Month nav */}
            <div className="mb-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMonth(subMonths(month, 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                {format(month, "MMMM yyyy")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMonth(addMonths(month, 1))}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 text-center">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <div
                  key={d}
                  className="py-1 text-xs font-medium text-muted-foreground"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Date grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const inMonth = isSameMonth(day, monthStart);
                  const isAvailable = availableDates.has(dateStr);
                  const isPast = isBefore(day, today);
                  const isToday = isSameDay(day, today);
                  const isSelected = dateStr === selectedDate;
                  const clickable = inMonth && isAvailable && !isPast;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && handleDayClick(dateStr)}
                      className={cn(
                        "mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors",
                        !inMonth && "text-gray-200",
                        inMonth && !isAvailable && "text-gray-300",
                        inMonth && isPast && "text-gray-300",
                        clickable &&
                          "cursor-pointer font-medium text-foreground hover:bg-brand-100",
                        isToday && clickable && "ring-1 ring-brand-400",
                        isSelected &&
                          "bg-brand-600 text-white hover:bg-brand-700",
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            ))}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Bold = available
            </p>
          </div>

          {/* Right: Time slots */}
          <div className="min-w-0 flex-1">
            {!selectedDate ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a date to see available times
              </div>
            ) : (
              <>
                <p className="mb-3 text-sm font-medium">
                  {format(new Date(selectedDate + "T12:00:00"), "EEEE, d MMMM")}
                </p>

                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading slots...
                  </div>
                ) : slots.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No available slots on this date.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          selectedSlot?.start === slot.start
                            ? "border-brand-600 bg-brand-50 text-brand-700"
                            : "hover:border-brand-400 hover:bg-brand-50/50",
                        )}
                      >
                        {slot.start} – {slot.end}
                      </button>
                    ))}
                  </div>
                )}

                {/* Confirm section */}
                {showConfirm && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">
                        {mode === "new" ? "Book for: " : "Reschedule to: "}
                      </span>
                      <span className="font-medium">
                        {format(new Date(selectedDate + "T12:00:00"), "d MMM yyyy")}
                        {" "}at {selectedSlot.start} – {selectedSlot.end}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {mode === "new"
                        ? "This will create a calendar event and notify the client."
                        : "This will update the calendar event and notify the client."}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          onConfirm(selectedDate, selectedSlot.start, selectedSlot.end)
                        }
                        disabled={isPending}
                        className="w-full"
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {mode === "new" ? "Creating..." : "Rescheduling..."}
                          </>
                        ) : (
                          mode === "new" ? "Confirm Booking" : "Confirm Reschedule"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
