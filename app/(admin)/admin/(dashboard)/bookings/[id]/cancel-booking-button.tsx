"use client";

import { useTransition, useState } from "react";
import { cancelBookingAction } from "../actions";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { XCircle, AlertTriangle, Ban } from "lucide-react";

interface CancelBookingButtonProps {
  bookingId: string;
  bookingDate: Date;
  bookingStartTime: string;
  priceZarCents: number;
  clientName: string;
  isFreeSession: boolean;
}

export function CancelBookingButton({
  bookingId,
  bookingDate,
  bookingStartTime,
  priceZarCents,
  clientName,
  isFreeSession,
}: CancelBookingButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const bookingDateTime = new Date(bookingDate);
  const [hours, minutes] = bookingStartTime.split(":").map(Number);
  bookingDateTime.setHours(hours, minutes, 0, 0);
  const hoursUntilBooking =
    (bookingDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const isLateCancel = hoursUntilBooking < 24 && hoursUntilBooking > -2;
  const showBillingPrompt = isLateCancel && !isFreeSession;

  function handleCancel(chargeLateFee: boolean) {
    startTransition(async () => {
      await cancelBookingAction(bookingId, chargeLateFee);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <XCircle className="mr-2 h-4 w-4 text-red-600" />
          Cancel Booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {showBillingPrompt ? (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            ) : (
              <Ban className="h-5 w-5 text-red-500" />
            )}
            Cancel Booking
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {showBillingPrompt ? (
                <>
                  <p>
                    This booking for <strong>{clientName}</strong> is within the{" "}
                    <strong>24-hour late cancellation window</strong>.
                  </p>
                  <p>
                    Would you like to charge the late cancellation fee (
                    {(priceZarCents / 100).toLocaleString("en-ZA", {
                      style: "currency",
                      currency: "ZAR",
                    })}
                    )? An invoice will be generated and emailed to the client.
                  </p>
                </>
              ) : (
                <p>
                  Are you sure you want to cancel this booking for{" "}
                  <strong>{clientName}</strong>? The client will be notified by
                  email.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            Keep Booking
          </AlertDialogCancel>
          {showBillingPrompt ? (
            <>
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => handleCancel(false)}
              >
                No Charge
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => handleCancel(true)}
              >
                {isPending ? "Cancelling..." : "Charge Late Fee"}
              </Button>
            </>
          ) : (
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleCancel(false);
              }}
            >
              {isPending ? "Cancelling..." : "Cancel Booking"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
