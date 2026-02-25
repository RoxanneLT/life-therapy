"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  ExternalLink,
  Video,
  AlertTriangle,
} from "lucide-react";
import { format, isAfter, startOfDay } from "date-fns";
import { markNoShowAction, adminCancelBookingAction } from "../actions";
import { RescheduleDialog } from "../../../bookings/[id]/reschedule-dialog";

interface BookingData {
  id: string;
  sessionType: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: string;
  teamsMeetingUrl: string | null;
  rescheduleCount: number;
  originalDate: string | null;
  originalStartTime: string | null;
  rescheduledAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  isLateCancel: boolean;
  creditRefunded: boolean;
  clientNotes: string | null;
}

interface SessionsTabProps {
  client: Record<string, unknown>;
}

const SESSION_TYPE_COLORS: Record<string, string> = {
  individual: "bg-green-100 text-green-700",
  couples: "bg-purple-100 text-purple-700",
  free_consultation: "bg-blue-100 text-blue-700",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  couples: "Couples",
  free_consultation: "Free Consultation",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-green-100 text-green-700",
  completed: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-600",
  no_show: "bg-red-100 text-red-700",
};

const STATUS_ICONS: Record<string, string> = {
  completed: "\u2713",
  cancelled: "\u2717",
  no_show: "\u2717",
  confirmed: "\ud83d\udfe2",
  pending: "\ud83d\udfe1",
};

export function SessionsTab({ client }: SessionsTabProps) {
  const clientId = client.id as string;
  const bookings = (client.bookings as BookingData[]) || [];
  const today = startOfDay(new Date());

  const upcoming = bookings
    .filter(
      (b) =>
        isAfter(new Date(b.date), today) &&
        (b.status === "pending" || b.status === "confirmed"),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const past = bookings
    .filter(
      (b) =>
        !isAfter(new Date(b.date), today) ||
        (b.status !== "pending" && b.status !== "confirmed"),
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (bookings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CalendarDays className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No sessions recorded.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Sessions</h2>
        <Button variant="outline" asChild>
          <a href="/book" target="_blank" rel="noopener noreferrer">
            Book on Behalf
          </a>
        </Button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upcoming
          </h3>
          {upcoming.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              clientId={clientId}
              isUpcoming
            />
          ))}
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Past
          </h3>
          {past.map((b) => (
            <BookingCard key={b.id} booking={b} clientId={clientId} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  clientId,
  isUpcoming = false,
}: {
  booking: BookingData;
  clientId: string;
  isUpcoming?: boolean;
}) {
  const b = booking;
  const dateStr = format(new Date(b.date), "EEE d MMM yyyy");

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            {/* Type + date + duration */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={SESSION_TYPE_COLORS[b.sessionType] || ""}>
                {SESSION_TYPE_LABELS[b.sessionType] || b.sessionType}
              </Badge>
              <span className="text-sm">
                {dateStr} at {b.startTime}
              </span>
              <span className="text-xs text-muted-foreground">
                {b.durationMinutes} min
              </span>
            </div>

            {/* Status line */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge variant="secondary" className={STATUS_COLORS[b.status] || ""}>
                {STATUS_ICONS[b.status] || ""} {b.status.replace("_", " ")}
              </Badge>
              {b.teamsMeetingUrl && (
                <a
                  href={b.teamsMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                >
                  <Video className="h-3 w-3" />
                  Join
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {b.rescheduleCount > 0 && (
                <span className="text-xs text-muted-foreground">
                  Reschedules: {b.rescheduleCount}/2
                </span>
              )}
            </div>

            {/* Cancellation details */}
            {b.status === "cancelled" && (
              <div className="text-xs text-muted-foreground">
                {b.cancelledBy && (
                  <span>Cancelled by {b.cancelledBy}</span>
                )}
                {b.isLateCancel && (
                  <span> · <span className="text-red-600">Late cancel</span></span>
                )}
                {b.creditRefunded ? (
                  <span> · Credit refunded</span>
                ) : b.isLateCancel ? (
                  <span> · Credit forfeited</span>
                ) : null}
                {b.cancellationReason && (
                  <span> · {b.cancellationReason}</span>
                )}
                {b.originalDate && (
                  <div>
                    Original date: {format(new Date(b.originalDate), "EEE d MMM")}
                    {b.rescheduledAt &&
                      ` (rescheduled ${format(new Date(b.rescheduledAt), "d MMM")})`}
                  </div>
                )}
              </div>
            )}

            {/* No-show details */}
            {b.status === "no_show" && (
              <p className="text-xs text-red-600">Credit forfeited</p>
            )}
          </div>

          {/* Admin actions for upcoming */}
          {isUpcoming && (
            <div className="flex shrink-0 gap-2">
              <RescheduleDialog
                bookingId={b.id}
                sessionType={b.sessionType}
                currentDate={dateStr}
                currentTime={`${b.startTime} – ${b.endTime}`}
              />
              <CancelDialog bookingId={b.id} clientId={clientId} />
              <NoShowDialog bookingId={b.id} clientId={clientId} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function NoShowDialog({
  bookingId,
  clientId,
}: {
  bookingId: string;
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      await markNoShowAction(bookingId, clientId);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-red-600">
          Mark No-Show
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as No-Show?</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-3 py-2">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm text-muted-foreground">
            This will mark the session as a no-show. The client&apos;s session
            credit will be forfeited.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Marking..." : "Mark No-Show"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  bookingId,
  clientId,
}: {
  bookingId: string;
  clientId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleCancel(refund: boolean) {
    startTransition(async () => {
      await adminCancelBookingAction(bookingId, clientId, refund);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Cancel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel Session</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Choose whether to refund the client&apos;s session credit.
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Keep Session
            </Button>
          </DialogClose>
          <Button
            variant="outline"
            onClick={() => handleCancel(false)}
            disabled={isPending}
          >
            {isPending ? "..." : "Cancel Without Refund"}
          </Button>
          <Button onClick={() => handleCancel(true)} disabled={isPending}>
            {isPending ? "..." : "Cancel & Refund Credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
