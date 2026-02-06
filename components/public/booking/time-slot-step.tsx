"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Clock } from "lucide-react";
import { format, parse } from "date-fns";
import type { SessionTypeConfig } from "@/lib/booking-config";
import type { TimeSlot } from "@/lib/availability";

interface TimeSlotStepProps {
  readonly sessionType: SessionTypeConfig;
  readonly date: string;
  readonly onSelect: (slot: TimeSlot) => void;
  readonly onBack: () => void;
}

export function TimeSlotStep({
  sessionType,
  date,
  onSelect,
  onBack,
}: TimeSlotStepProps) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSlots() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/booking/available-slots?type=${sessionType.type}&date=${date}`
        );
        const data = await res.json();
        setSlots(data.slots || []);
      } catch {
        setSlots([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSlots();
  }, [sessionType.type, date]);

  const dateObj = parse(date, "yyyy-MM-dd", new Date());
  const dateLabel = format(dateObj, "EEEE, d MMMM yyyy");

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-xl font-bold">Select a Time</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Available times for {dateLabel}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No available time slots for this date. Please try another date.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {slots.map((slot) => (
            <Button
              key={slot.start}
              variant="outline"
              className="flex items-center gap-1 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700"
              onClick={() => onSelect(slot)}
            >
              <Clock className="h-3 w-3" />
              {slot.start}
            </Button>
          ))}
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
