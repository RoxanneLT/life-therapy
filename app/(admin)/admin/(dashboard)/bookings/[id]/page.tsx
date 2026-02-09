export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { formatPrice } from "@/lib/utils";
import type { Currency } from "@/lib/region";
import { format } from "date-fns";
import { updateBookingStatus, updateBookingNotes, deleteBooking } from "../actions";
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
} from "lucide-react";
import Link from "next/link";
import type { BookingStatus } from "@/lib/generated/prisma/client";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
};

interface Props {
  readonly params: { readonly id: string };
}

export default async function BookingDetailPage({ params }: Props) {
  await requireRole("super_admin", "editor");

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
  });

  if (!booking) notFound();

  const config = getSessionTypeConfig(booking.sessionType);

  async function handleStatusChange(formData: FormData) {
    "use server";
    const status = formData.get("status") as BookingStatus;
    await updateBookingStatus(params.id, status);
  }

  async function handleNotesUpdate(formData: FormData) {
    "use server";
    await updateBookingNotes(params.id, formData);
  }

  async function handleDelete() {
    "use server";
    await deleteBooking(params.id);
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
                className={STATUS_STYLES[booking.status]}
              >
                {booking.status.replace("_", " ")}
              </Badge>
            </div>
            {booking.teamsMeetingUrl && (
              <>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Teams Meeting</span>
                  <a
                    href={booking.teamsMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-brand-600 hover:underline"
                  >
                    <Video className="h-4 w-4" />
                    Join
                  </a>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle>Client</CardTitle>
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
              Change the booking status. Cancelling will also notify the client.
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
              <form action={handleStatusChange}>
                <input type="hidden" name="status" value="cancelled" />
                <Button type="submit" variant="outline" size="sm">
                  <XCircle className="mr-2 h-4 w-4 text-red-600" />
                  Cancel Booking
                </Button>
              </form>
            </div>
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
    </div>
  );
}
