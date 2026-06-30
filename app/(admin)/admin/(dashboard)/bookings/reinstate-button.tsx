"use client";

import { useTransition } from "react";
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
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reinstateBookingAction } from "./actions";

export function ReinstateButton({
  bookingId,
  clientName,
}: {
  readonly bookingId: string;
  readonly clientName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleReinstate() {
    startTransition(async () => {
      try {
        const res = await reinstateBookingAction(bookingId);
        if (res?.calendarWarning) {
          toast.warning(res.calendarWarning);
        } else {
          toast.success(`Session reinstated — ${clientName} re-invited with a fresh Teams link.`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not reinstate the session.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          disabled={isPending}
          title="Reinstate session"
          aria-label="Reinstate session"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reinstate this session?</AlertDialogTitle>
          <AlertDialogDescription>
            Re-activates {clientName}&apos;s cancelled session: a new Outlook/Teams meeting is
            created (they get a fresh invite + join link), and any late-cancellation fee flag is
            cleared so they&apos;re billed once, as a normal session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleReinstate();
            }}
          >
            {isPending ? "Reinstating…" : "Reinstate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
