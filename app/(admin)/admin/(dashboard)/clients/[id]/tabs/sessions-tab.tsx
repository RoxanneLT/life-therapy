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
  Pencil,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, isAfter, startOfDay } from "date-fns";
import { markNoShowAction, adminCancelBookingAction, adminLateCancelWithFeeAction } from "../actions";
import { updateBookingStatus } from "../../../bookings/actions";
import { RescheduleDialog } from "../../../bookings/[id]/reschedule-dialog";
import type { BookingStatus } from "@/lib/generated/prisma/client";
import { BOOKING_STATUS_BADGE } from "@/lib/status-styles";

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
  priceZarCents: number;
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


const STATUS_ICONS: Record<string, string> = {
  completed: "\u2713",
  cancelled: "\u2717",
  no_show: "\u2717",
  confirmed: "\ud83d\udfe2",
  pending: "\ud83d\udfe1",
};

export function SessionsTab({ client }: SessionsTabProps) {
  const clientId = client.id as string;
  const isPostpaid = client.billingType === "postpaid";
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
              isPostpaid={isPostpaid}
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
            <BookingCard key={b.id} booking={b} clientId={clientId} isPostpaid={isPostpaid} />
          ))}
        </div>
      )}
    </div>
  );
}

const EDITABLE_STATUSES = [
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
];

function QuickStatusEdit({
  bookingId,
  currentStatus,
  clientId,
}: {
  bookingId: string;
  currentStatus: string;
  clientId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleChange(newStatus: string) {
    if (newStatus === currentStatus) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await updateBookingStatus(bookingId, newStatus as BookingStatus);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <Select
        value={currentStatus}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-7 w-[130px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EDITABLE_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      onClick={() => setEditing(true)}
      title="Edit session status"
    >
      <Pencil className="h-3 w-3" />
    </Button>
  );
}

function BookingCard({
  booking,
  clientId,
  isUpcoming = false,
  isPostpaid = false,
}: {
  booking: BookingData;
  clientId: string;
  isUpcoming?: boolean;
  isPostpaid?: boolean;
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
              <Badge variant="secondary" className={BOOKING_STATUS_BADGE[b.status] || ""}>
                {STATUS_ICONS[b.status] || ""} {b.status.replace("_", " ")}
              </Badge>
              {!isUpcoming && (
                <QuickStatusEdit
                  bookingId={b.id}
                  currentStatus={b.status}
                  clientId={clientId}
                />
              )}
              {b.teamsMeetingUrl && isUpcoming && !["cancelled", "no_show"].includes(b.status) && (
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
                {!isPostpaid && b.creditRefunded ? (
                  <span> · Credit refunded</span>
                ) : !isPostpaid && b.isLateCancel ? (
                  <span> · Credit forfeited</span>
                ) : isPostpaid && b.isLateCancel ? (
                  <span> · Late cancel fee applies</span>
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
              <p className="text-xs text-red-600">
                {isPostpaid ? "No-show — session will be invoiced" : "Credit forfeited"}
              </p>
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
              <CancelDialog
                bookingId={b.id}
                clientId={clientId}
                bookingDate={b.date}
                bookingStartTime={b.startTime}
                priceZarCents={b.priceZarCents}
              />
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
  bookingDate,
  bookingStartTime,
  priceZarCents,
}: {
  bookingId: string;
  clientId: string;
  bookingDate: string;
  bookingStartTime: string;
  priceZarCents: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  // Detect late-cancel: booking starts within 24 hours
  const bookingDateTime = new Date(bookingDate);
  const [hours, minutes] = bookingStartTime.split(":").map(Number);
  bookingDateTime.setHours(hours, minutes, 0, 0);
  const hoursUntilBooking = (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const isLateCancel = hoursUntilBooking < 24 && hoursUntilBooking > -2;
  const showLateFeeOption = isLateCancel && priceZarCents > 0;

  function handleCancel(refund: boolean) {
    startTransition(async () => {
      await adminCancelBookingAction(bookingId, clientId, refund);
      setOpen(false);
    });
  }

  function handleLateFeeCancel() {
    startTransition(async () => {
      await adminLateCancelWithFeeAction(bookingId, clientId);
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
        {showLateFeeOption && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800">
            ⚠️ This session starts within 24 hours. If the client agreed to the
            late cancellation fee, use &quot;Cancel — Charge Late Fee&quot; to
            cancel and issue an invoice automatically.
          </div>
        )}
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
            {isPending ? "..." : "Cancel — No Charge"}
          </Button>
          <Button onClick={() => handleCancel(true)} disabled={isPending}>
            {isPending ? "..." : "Cancel & Refund Credit"}
          </Button>
          {showLateFeeOption && (
            <Button
              variant="destructive"
              onClick={handleLateFeeCancel}
              disabled={isPending}
            >
              {isPending ? "..." : "Cancel — Charge Late Fee"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
