"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Clock } from "lucide-react";
import { parse, format } from "date-fns";
import type { SessionTypeConfig } from "@/lib/booking-config";
import type { TimeSlot } from "@/lib/availability";

interface DateTimeStepProps {
  readonly sessionType: SessionTypeConfig;
  readonly onSelect: (date: string, slot: TimeSlot) => void;
  readonly onBack: () => void;
}

export function DateTimeStep({
  sessionType,
  onSelect,
  onBack,
}: DateTimeStepProps) {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Fetch available dates
  useEffect(() => {
    async function fetchDates() {
      setLoadingDates(true);
      try {
        const res = await fetch(
          `/api/booking/available-dates?type=${sessionType.type}`
        );
        const data = await res.json();
        setAvailableDates(data.dates || []);
      } catch {
        setAvailableDates([]);
      } finally {
        setLoadingDates(false);
      }
    }
    fetchDates();
  }, [sessionType.type]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!selectedDateStr) {
      setSlots([]);
      return;
    }
    async function fetchSlots() {
      setLoadingSlots(true);
      try {
        const res = await fetch(
          `/api/booking/available-slots?type=${sessionType.type}&date=${selectedDateStr}`
        );
        const data = await res.json();
        setSlots(data.slots || []);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    }
    fetchSlots();
  }, [sessionType.type, selectedDateStr]);

  const availableSet = new Set(availableDates);

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    if (!availableSet.has(dateStr)) return;
    setSelectedDate(date);
    setSelectedDateStr(dateStr);
  }

  function isDisabled(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    return !availableSet.has(dateStr);
  }

  const dateLabel = selectedDateStr
    ? format(parse(selectedDateStr, "yyyy-MM-dd", new Date()), "EEE, d MMM")
    : null;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-xl font-bold">Select Date & Time</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an available date and time for your{" "}
          {sessionType.label.toLowerCase()}.
        </p>
      </div>

      {loadingDates ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : availableDates.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No available dates at the moment. Please check back later.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-stretch md:justify-center">
          {/* Calendar */}
          <div className="shrink-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={isDisabled}
              fromDate={
                availableDates.length > 0
                  ? parse(availableDates[0], "yyyy-MM-dd", new Date())
                  : undefined
              }
              toDate={
                availableDates.length > 0
                  ? parse(
                      availableDates[availableDates.length - 1],
                      "yyyy-MM-dd",
                      new Date()
                    )
                  : undefined
              }
            />
          </div>

          {/* Time slots panel — md:pt-3 + h-8 matches Calendar's p-3 padding + month_caption height */}
          <div className="w-full md:w-64 lg:w-72 md:pt-3">
            {!selectedDateStr ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-6">
                <p className="text-center text-sm text-muted-foreground">
                  Select a date to see available times
                </p>
              </div>
            ) : loadingSlots ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
              </div>
            ) : slots.length === 0 ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 p-6">
                <p className="text-center text-sm text-muted-foreground">
                  No available times for this date.
                  <br />
                  Please try another date.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="flex h-8 items-center justify-center text-sm font-medium text-muted-foreground">
                  {dateLabel}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => (
                    <Button
                      key={slot.start}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700"
                      onClick={() => onSelect(selectedDateStr, slot)}
                    >
                      <Clock className="h-3 w-3" />
                      {slot.start}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-start">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  );
}
