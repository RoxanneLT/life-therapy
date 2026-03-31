"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
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
import { CalendarClock, Repeat, AlertTriangle, CheckCircle } from "lucide-react";
import { rescheduleSeriesAction, checkSeriesConflictsAction } from "../actions";
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
  readonly currentDayOfWeek: number;
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

  const initialDay = currentDayOfWeek === 0 ? "1" : String(currentDayOfWeek);
  const [dayOfWeek, setDayOfWeek] = useState(initialDay);
  const [startTime, setStartTime] = useState(currentTime);
  const [conflicts, setConflicts] = useState<{ date: string; conflict: string | null }[]>([]);
  const [checking, setChecking] = useState(false);

  const dayChanged = dayOfWeek !== initialDay;
  const timeChanged = startTime !== currentTime;
  const hasChanges = dayChanged || timeChanged;
  const conflictCount = conflicts.filter((c) => c.conflict).length;

  const checkConflicts = useCallback(async () => {
    if (!hasChanges) {
      setConflicts([]);
      return;
    }
    setChecking(true);
    try {
      const results = await checkSeriesConflictsAction(seriesId, parseInt(dayOfWeek), startTime);
      setConflicts(results);
    } catch {
      setConflicts([]);
    }
    setChecking(false);
  }, [seriesId, dayOfWeek, startTime, hasChanges]);

  useEffect(() => {
    if (open && hasChanges) {
      checkConflicts();
    } else {
      setConflicts([]);
    }
  }, [open, dayOfWeek, startTime, hasChanges, checkConflicts]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Repeat className="mr-2 h-4 w-4" />
          <CalendarClock className="mr-2 h-4 w-4" />
          Edit Series
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule Recurring Series</DialogTitle>
          <DialogDescription>
            Change the day and time for {futureCount} future session{futureCount !== 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
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

          {/* Conflict preview */}
          {hasChanges && !checking && conflicts.length > 0 && (
            <div className="space-y-1.5 rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                {conflictCount > 0 ? (
                  <span className="text-amber-600">
                    <AlertTriangle className="mr-1 inline h-3 w-3" />
                    {conflictCount} conflict{conflictCount !== 1 ? "s" : ""} found
                  </span>
                ) : (
                  <span className="text-green-600">
                    <CheckCircle className="mr-1 inline h-3 w-3" />
                    No conflicts — all dates available
                  </span>
                )}
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {conflicts.map((c) => (
                  <div key={c.date} className="flex items-center justify-between text-xs">
                    <span className={c.conflict ? "text-amber-700" : "text-muted-foreground"}>
                      {c.date}
                    </span>
                    {c.conflict ? (
                      <span className="text-amber-600 font-medium">{c.conflict}</span>
                    ) : (
                      <span className="text-green-600">Available</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {checking && (
            <p className="text-xs text-muted-foreground">Checking availability...</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !hasChanges}
            variant={conflictCount > 0 ? "destructive" : "default"}
          >
            {isPending
              ? "Rescheduling..."
              : conflictCount > 0
                ? `Reschedule Anyway (${conflictCount} conflict${conflictCount !== 1 ? "s" : ""})`
                : `Reschedule ${futureCount} Session${futureCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
