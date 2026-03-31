"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CalendarClock, Repeat } from "lucide-react";
import { rescheduleSeriesAction } from "../actions";
import { toast } from "sonner";

const DAYS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
];

const TIME_SLOTS = [
  "09:00", "10:15", "11:30", "13:00", "14:15", "15:30",
];

interface Props {
  readonly seriesId: string;
  readonly currentDayOfWeek: number; // 0=Sun..6=Sat
  readonly currentTime: string;
  readonly futureCount: number;
}

export function RescheduleSeriesDialog({
  seriesId,
  currentDayOfWeek,
  currentTime,
  futureCount,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Convert JS day (0=Sun) to our select (1=Mon..5=Fri)
  const initialDay = currentDayOfWeek === 0 ? "1" : String(currentDayOfWeek);
  const [dayOfWeek, setDayOfWeek] = useState(initialDay);
  const [startTime, setStartTime] = useState(currentTime);

  function handleSubmit() {
    startTransition(async () => {
      try {
        const result = await rescheduleSeriesAction(seriesId, parseInt(dayOfWeek), startTime);
        toast.success(`${result.updated} future session${result.updated !== 1 ? "s" : ""} rescheduled`);
        setOpen(false);
      } catch {
        toast.error("Failed to reschedule series");
      }
    });
  }

  const dayChanged = dayOfWeek !== initialDay;
  const timeChanged = startTime !== currentTime;
  const hasChanges = dayChanged || timeChanged;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Repeat className="mr-2 h-4 w-4" />
          <CalendarClock className="mr-2 h-4 w-4" />
          Edit Series
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule Recurring Series</DialogTitle>
          <DialogDescription>
            Change the day and time for all {futureCount} future session{futureCount !== 1 ? "s" : ""} in this series.
            Past and completed sessions won&apos;t be affected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Time Slot</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || !hasChanges}>
            {isPending ? "Rescheduling..." : `Reschedule ${futureCount} Session${futureCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
