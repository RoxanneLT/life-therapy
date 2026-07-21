"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarSync } from "lucide-react";
import { rebuildSeriesCalendarAction } from "../actions";

/**
 * Repair control for a series whose Outlook event is wrong or missing while the
 * bookings themselves are correct — the state the 2026-07 day-of-week incident left
 * several clients in. "Reschedule series" cannot do this (it requires the day or time
 * to change); this rebuilds the calendar event in place and moves nothing.
 */
export function RebuildSeriesCalendarButton({
  seriesId,
  clientName,
  futureCount,
}: Readonly<{ seriesId: string; clientName: string; futureCount: number }>) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        const res = await rebuildSeriesCalendarAction(seriesId);
        if (res.rebuilt === 0) {
          toast.error(res.warning ?? "Nothing was rebuilt.");
        } else {
          const pruned = res.pruned > 0 ? `, ${res.pruned} surplus occurrence(s) removed` : "";
          toast.success(`Calendar rebuilt for ${res.rebuilt} session(s)${pruned}.`);
          if (res.warning) toast.warning(res.warning);
        }
        setOpen(false);
      } catch {
        toast.error("Could not rebuild the calendar event. Nothing was changed.");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarSync className="mr-1 h-3 w-3" />
        Rebuild calendar
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebuild the calendar event for this series?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Use this when the sessions are correct in the portal but wrong or missing
                  in Outlook. It deletes the current recurring event and creates a correct
                  one from the {futureCount} upcoming session(s).
                </p>
                <p>
                  <strong>No booking is moved</strong> — dates, times and statuses stay
                  exactly as they are. Occurrences on dates with no booking are removed, so
                  holidays and cancelled sessions do not reappear.
                </p>
                <p className="text-amber-700">
                  {clientName} will receive a fresh calendar invite, and any existing invite
                  for this series becomes obsolete.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); run(); }} disabled={isPending}>
              {isPending ? "Rebuilding…" : "Rebuild calendar event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
