"use client";

import { useEffect, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import { parse, format } from "date-fns";
import type { SessionTypeConfig } from "@/lib/booking-config";

interface DatePickerStepProps {
  readonly sessionType: SessionTypeConfig;
  readonly onSelect: (date: string) => void;
  readonly onBack: () => void;
}

export function DatePickerStep({
  sessionType,
  onSelect,
  onBack,
}: DatePickerStepProps) {
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date | undefined>();

  useEffect(() => {
    async function fetchDates() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/booking/available-dates?type=${sessionType.type}`
        );
        const data = await res.json();
        setAvailableDates(data.dates || []);
      } catch {
        setAvailableDates([]);
      } finally {
        setLoading(false);
      }
    }
    fetchDates();
  }, [sessionType.type]);

  const availableSet = new Set(availableDates);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    if (!availableSet.has(dateStr)) return;
    setSelected(date);
    onSelect(dateStr);
  }

  function isDisabled(date: Date) {
    const dateStr = format(date, "yyyy-MM-dd");
    return !availableSet.has(dateStr);
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-xl font-bold">Select a Date</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose an available date for your {sessionType.label.toLowerCase()}.
        </p>
      </div>

      {loading ? (
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
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
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
