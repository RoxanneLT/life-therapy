"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarDays,
  CalendarClock,
  Video,
  Clock,
  AlertTriangle,
  XCircle,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { format, isPast, differenceInHours } from "date-fns";
import { cn } from "@/lib/utils";
import { ReschedulePicker } from "@/components/booking/reschedule-picker";
import {
  portalCancelBookingAction,
  portalRescheduleBookingAction,
} from "./actions";
import {
  CANCEL_NOTICE_HOURS,
  MAX_RESCHEDULES,
  RESCHEDULE_NOTICE_HOURS,
} from "@/lib/booking-policy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SerializedBooking {
  id: string;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  teamsMeetingUrl: string | null;
  rescheduleCount: number;
  rescheduledAt: string | null;
  originalDate: string | null;
  originalStartTime: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  creditRefunded: boolean;
  isLateCancel: boolean;
  cancelledAt: string | null;
}

const SESSION_LABELS: Record<string, string> = {
  free_consultation: "Free Consultation",
  individual: "1:1 Individual",
  couples: "Couples Session",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Pending", variant: "outline" },
  confirmed: { label: "Confirmed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  completed: { label: "Completed", variant: "secondary" },
  no_show: { label: "No Show", variant: "destructive" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingsClient({
  bookings,
}: Readonly<{ bookings: SerializedBooking[] }>) {
  const now = new Date();

  const upcoming = bookings.filter(
    (b) =>
      (b.status === "pending" || b.status === "confirmed") &&
      !isPast(new Date(b.date + "T" + b.endTime + ":00"))
  );

  const past = bookings.filter(
    (b) =>
      b.status === "completed" ||
      b.status === "cancelled" ||
      b.status === "no_show" ||
      (["pending", "confirmed"].includes(b.status) &&
        isPast(new Date(b.date + "T" + b.endTime + ":00")))
  );

  return (
    <div className="space-y-8">
      {/* Upcoming */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Upcoming Sessions</h2>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No upcoming sessions.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <UpcomingBookingCard key={b.id} booking={b} now={now} />
            ))}
          </div>
        )}
      </section>

      {/* Past */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Past Sessions</h2>
        {past.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No past sessions.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {past.map((b) => (
              <PastBookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upcoming Booking Card
// ---------------------------------------------------------------------------

function UpcomingBookingCard({
  booking: b,
  now,
}: Readonly<{ booking: SerializedBooking; now: Date }>) {
  const sessionDate = new Date(b.date + "T" + b.startTime + ":00");
  const hoursUntil = differenceInHours(sessionDate, now);
  const canReschedule =
    b.rescheduleCount < MAX_RESCHEDULES && hoursUntil >= RESCHEDULE_NOTICE_HOURS;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_CONFIG[b.status]?.variant ?? "outline"}>
              {SESSION_LABELS[b.sessionType] || b.sessionType}
            </Badge>
            {b.rescheduleCount > 0 && (
              <span className="text-xs text-muted-foreground">
                (rescheduled {b.rescheduleCount}x)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              {format(new Date(b.date + "T12:00:00"), "EEEE, d MMMM yyyy")}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {b.startTime} – {b.endTime}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {b.teamsMeetingUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={b.teamsMeetingUrl} target="_blank" rel="noopener noreferrer">
                <Video className="mr-2 h-4 w-4" />
                Join
              </a>
            </Button>
          )}
          {canReschedule && (
            <RescheduleBookingDialog booking={b} />
          )}
          <CancelBookingDialog booking={b} hoursUntil={hoursUntil} />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Past Booking Card
// ---------------------------------------------------------------------------

function PastBookingCard({ booking: b }: Readonly<{ booking: SerializedBooking }>) {
  const statusCfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.pending;

  return (
    <Card className="opacity-75">
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant={statusCfg.variant}>
              {statusCfg.label}
            </Badge>
            <span className="text-sm font-medium">
              {SESSION_LABELS[b.sessionType] || b.sessionType}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(b.date + "T12:00:00"), "d MMM yyyy")} at{" "}
            {b.startTime} – {b.endTime}
          </p>
          {b.status === "cancelled" && (
            <div className="text-xs text-muted-foreground">
              {b.isLateCancel && (
                <span className="text-amber-600 font-medium">Late cancel — </span>
              )}
              {b.creditRefunded ? "Credit refunded" : "Credit forfeited"}
              {b.cancellationReason && ` • "${b.cancellationReason}"`}
            </div>
          )}
          {b.originalDate && b.originalDate !== b.date && (
            <p className="text-xs text-muted-foreground">
              Originally: {format(new Date(b.originalDate + "T12:00:00"), "d MMM yyyy")}
              {b.originalStartTime && ` at ${b.originalStartTime}`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cancel Dialog
// ---------------------------------------------------------------------------

function CancelBookingDialog({
  booking: b,
  hoursUntil,
}: Readonly<{ booking: SerializedBooking; hoursUntil: number }>) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  // Determine cancel type for UI hints (server re-validates)
  const isAntiAbuse =
    b.rescheduledAt &&
    b.originalDate &&
    b.originalStartTime &&
    b.originalDate !== b.date;
  const isLate = !isAntiAbuse && hoursUntil < CANCEL_NOTICE_HOURS;
  const isNormal = !isAntiAbuse && !isLate;

  function handleCancel() {
    startTransition(async () => {
      await portalCancelBookingAction(b.id, reason);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <XCircle className="mr-2 h-4 w-4" />
        Cancel
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Session</DialogTitle>
          <DialogDescription>
            {SESSION_LABELS[b.sessionType] || b.sessionType} on{" "}
            {format(new Date(b.date + "T12:00:00"), "d MMMM yyyy")} at{" "}
            {b.startTime}
          </DialogDescription>
        </DialogHeader>

        {/* Normal cancel */}
        {isNormal && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Your session credit will be refunded to your balance.</p>
            </div>
            <Textarea
              placeholder="Reason for cancelling (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* Late cancel */}
        {isLate && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Less than {CANCEL_NOTICE_HOURS} hours notice</p>
                <p className="mt-1">
                  Your session credit will <strong>not</strong> be refunded.
                  Consider rescheduling instead if a different time works for you.
                </p>
              </div>
            </div>
            <Textarea
              placeholder="Reason for cancelling (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        )}

        {/* Anti-abuse */}
        {isAntiAbuse && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <Ban className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Credit will be forfeited</p>
                <p className="mt-1">
                  This session was rescheduled from a time within the {CANCEL_NOTICE_HOURS}-hour
                  cancellation window. The credit cannot be refunded.
                </p>
              </div>
            </div>
            <Textarea
              placeholder="Reason for cancelling (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep Session
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? "Cancelling..." : isNormal ? "Cancel Session" : "Cancel Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reschedule Dialog
// ---------------------------------------------------------------------------

function RescheduleBookingDialog({
  booking: b,
}: Readonly<{ booking: SerializedBooking }>) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm(date: string, startTime: string, endTime: string) {
    startTransition(async () => {
      await portalRescheduleBookingAction(b.id, date, startTime, endTime);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock className="mr-2 h-4 w-4" />
        Reschedule
      </Button>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule Session</DialogTitle>
        </DialogHeader>
        {open && (
          <ReschedulePicker
            sessionType={b.sessionType}
            currentDate={format(new Date(b.date + "T12:00:00"), "EEEE, d MMMM yyyy")}
            currentTime={`${b.startTime} – ${b.endTime}`}
            onConfirm={handleConfirm}
            isPending={isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
