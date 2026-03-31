export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { formatPrice } from "@/lib/utils";
import type { Currency } from "@/lib/region";
import { format } from "date-fns";
import { updateBookingStatus, updateBookingNotes, updateSessionNotes, deleteBooking, togglePolicyOverrideAction } from "../actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  UserX,
  Video,
  ArrowLeft,
  Repeat,
  ShieldCheck,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import type { BookingStatus } from "@/lib/generated/prisma/client";
import { BOOKING_STATUS_BADGE } from "@/lib/status-styles";
import { RescheduleDialog } from "./reschedule-dialog";
import { RescheduleSeriesDialog } from "./reschedule-series-dialog";
import { CancelBookingButton } from "./cancel-booking-button";

const PATTERN_LABELS: Record<string, string> = {
  weekly: "Weekly",
  bimonthly: "Bi-monthly",
  monthly: "Monthly",
};

interface Props {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function BookingDetailPage({ params }: Props) {
  const { id } = await params;
  await requireRole("super_admin", "editor");

  const booking = await prisma.booking.findUnique({
    where: { id },
  });

  if (!booking) notFound();

  const config = getSessionTypeConfig(booking.sessionType);

  // Count future bookings in this series (for edit series button)
  const futureSeriesCount = booking.recurringSeriesId
    ? await prisma.booking.count({
        where: {
          recurringSeriesId: booking.recurringSeriesId,
          status: { in: ["confirmed", "pending"] },
          date: { gte: new Date() },
        },
      })
    : 0;

  const previousBookings = booking.studentId
    ? await prisma.booking.findMany({
        where: {
          studentId: booking.studentId,
          id: { not: booking.id },
          status: { in: ["completed", "no_show"] },
        },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          id: true,
          date: true,
          sessionType: true,
          adminNotes: true,
          sessionNotes: true,
          clientNotes: true,
        },
      })
    : [];

  async function handleStatusChange(formData: FormData) {
    "use server";
    const status = formData.get("status") as BookingStatus;
    await updateBookingStatus(id, status);
  }

  async function handleNotesUpdate(formData: FormData) {
    "use server";
    await updateBookingNotes(id, formData);
  }

  async function handleDelete() {
    "use server";
    await deleteBooking(id);
  }

  async function handleTogglePolicyOverride() {
    "use server";
    await togglePolicyOverrideAction(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/bookings">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold">
              Booking Details
            </h1>
            <p className="text-sm text-muted-foreground">
              {config.label} — {booking.clientName}
            </p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Booking</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this booking and remove the
                calendar event. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <form action={handleDelete}>
                <AlertDialogAction
                  type="submit"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{config.label}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">
                {format(new Date(booking.date), "EEEE, d MMMM yyyy")}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {booking.startTime} – {booking.endTime} ({booking.durationMinutes} min)
              </span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="font-medium">
                {booking.priceZarCents === 0
                  ? "Free"
                  : formatPrice(booking.priceZarCents, (booking.priceCurrency || "ZAR") as Currency)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="secondary"
                className={BOOKING_STATUS_BADGE[booking.status]}
              >
                {booking.status.replace("_", " ")}
              </Badge>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Location</span>
              {booking.sessionMode === "in_person" ? (
                <span className="flex items-center gap-1 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  In Person — Paarl
                </span>
              ) : booking.teamsMeetingUrl && !["cancelled", "completed", "no_show"].includes(booking.status) ? (
                <a
                  href={booking.teamsMeetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
                >
                  <Video className="h-4 w-4" />
                  Teams — Join
                </a>
              ) : (
                <span className="text-sm text-muted-foreground">Online</span>
              )}
            </div>
            {booking.recurringSeriesId && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Series</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                      <Repeat className="mr-1 h-3 w-3" />
                      {PATTERN_LABELS[booking.recurringPattern ?? ""] ?? "Recurring"}
                    </Badge>
                    <Link
                      href={`/admin/bookings?series=${booking.recurringSeriesId}`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      View all
                    </Link>
                    {futureSeriesCount > 0 && (
                      <RescheduleSeriesDialog
                        seriesId={booking.recurringSeriesId!}
                        currentDayOfWeek={new Date(booking.date).getUTCDay()}
                        currentTime={booking.startTime}
                        futureCount={futureSeriesCount}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Client Info */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Client</CardTitle>
            {booking.studentId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/clients/${booking.studentId}`}>
                  View Client
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{booking.clientName}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <a
                href={`mailto:${booking.clientEmail}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {booking.clientEmail}
              </a>
            </div>
            {booking.clientPhone && (
              <>
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{booking.clientPhone}</span>
                </div>
              </>
            )}
            {booking.clientNotes && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Notes from client</span>
                  <p className="mt-1 text-sm">{booking.clientNotes}</p>
                </div>
              </>
            )}
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booked</span>
              <span className="text-sm">
                {format(new Date(booking.createdAt), "d MMM yyyy, HH:mm")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Actions */}
      {booking.status !== "cancelled" && (
        <Card>
          <CardHeader>
            <CardTitle>Update Status</CardTitle>
            <CardDescription>
              Change the booking status. Cancelling notifies the client by email but <strong>does not generate an invoice</strong> — use Cancel → Charge Late Fee if a cancellation fee applies. Use No Show for clients who did not attend without cancelling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {booking.status !== "confirmed" && (
                <form action={handleStatusChange}>
                  <input type="hidden" name="status" value="confirmed" />
                  <Button type="submit" variant="outline" size="sm">
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Confirm
                  </Button>
                </form>
              )}
              {booking.status !== "completed" && (
                <form action={handleStatusChange}>
                  <input type="hidden" name="status" value="completed" />
                  <Button type="submit" variant="outline" size="sm">
                    <Clock className="mr-2 h-4 w-4 text-blue-600" />
                    Mark Completed
                  </Button>
                </form>
              )}
              {booking.status !== "no_show" && (
                <form action={handleStatusChange}>
                  <input type="hidden" name="status" value="no_show" />
                  <Button type="submit" variant="outline" size="sm">
                    <UserX className="mr-2 h-4 w-4 text-gray-600" />
                    No Show
                  </Button>
                </form>
              )}
              <RescheduleDialog
                bookingId={booking.id}
                sessionType={booking.sessionType}
                currentDate={format(new Date(booking.date), "d MMM yyyy")}
                currentTime={`${booking.startTime} – ${booking.endTime}`}
              />
              <CancelBookingButton
                bookingId={booking.id}
                bookingDate={booking.date}
                bookingStartTime={booking.startTime}
                priceZarCents={booking.priceZarCents}
                clientName={booking.clientName}
                isFreeSession={booking.priceZarCents === 0}
              />
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                  Policy Override
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Allow client to reschedule/cancel outside normal policy windows
                </p>
              </div>
              <form action={handleTogglePolicyOverride}>
                <Button
                  type="submit"
                  variant={booking.policyOverride ? "default" : "outline"}
                  size="sm"
                >
                  {booking.policyOverride ? "Override Active" : "Enable Override"}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Notes — only for completed sessions */}
      {(booking.status === "completed" || booking.status === "no_show") && (
        <Card>
          <CardHeader>
            <CardTitle>Session Notes</CardTitle>
            <CardDescription>
              Private therapist notes about this session. Not visible to the client.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={async (formData: FormData) => {
              "use server";
              await updateSessionNotes(booking.id, formData);
            }}>
              <Textarea
                name="sessionNotes"
                defaultValue={booking.sessionNotes || ""}
                rows={4}
                placeholder="How did the session go? Key topics, breakthroughs, follow-up needed..."
              />
              <div className="mt-2 flex justify-end">
                <Button type="submit" size="sm">Save Notes</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Admin Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Notes</CardTitle>
          <CardDescription>
            Internal notes — not visible to the client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleNotesUpdate} className="space-y-3">
            <Label htmlFor="adminNotes" className="sr-only">
              Admin Notes
            </Label>
            <Textarea
              id="adminNotes"
              name="adminNotes"
              rows={4}
              defaultValue={booking.adminNotes || ""}
              placeholder="Add internal notes about this booking..."
            />
            <Button type="submit" size="sm">
              Save Notes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Previous Session Notes */}
      {booking.studentId && (
        <Card>
          <CardHeader>
            <CardTitle>Previous Session Notes</CardTitle>
            <CardDescription>
              Notes from the client&apos;s recent completed sessions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previousBookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No previous sessions for this client.
              </p>
            ) : (
              <div className="space-y-4">
                {previousBookings.map((prev) => {
                  const prevConfig = getSessionTypeConfig(prev.sessionType);
                  return (
                    <div key={prev.id} className="space-y-1.5 rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {prevConfig.label} — {format(new Date(prev.date), "d MMM yyyy")}
                        </span>
                        <Link
                          href={`/admin/bookings/${prev.id}`}
                          className="text-xs text-brand-600 hover:underline"
                        >
                          View
                        </Link>
                      </div>
                      {prev.sessionNotes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Session notes</p>
                          <p className="text-sm whitespace-pre-wrap">{prev.sessionNotes}</p>
                        </div>
                      )}
                      {prev.adminNotes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Your notes</p>
                          <p className="text-sm whitespace-pre-wrap">{prev.adminNotes}</p>
                        </div>
                      )}
                      {prev.clientNotes && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Client notes</p>
                          <p className="text-sm whitespace-pre-wrap">{prev.clientNotes}</p>
                        </div>
                      )}
                      {!prev.sessionNotes && !prev.adminNotes && !prev.clientNotes && (
                        <p className="text-xs text-muted-foreground italic">No notes</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
