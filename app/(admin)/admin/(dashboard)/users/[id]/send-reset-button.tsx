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
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { sendUserPasswordResetAction } from "../actions";

export function SendResetButton({
  adminUserId,
  email,
}: {
  readonly adminUserId: string;
  readonly email: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    startTransition(async () => {
      const res = await sendUserPasswordResetAction(adminUserId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(`Password reset link sent to ${email}.`);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Mail className="mr-2 h-4 w-4" />
          Send password reset
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send a password reset email?</AlertDialogTitle>
          <AlertDialogDescription>
            We&apos;ll email {email} a secure link to set a new password. Their current
            password keeps working until they use it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            {isPending ? "Sending…" : "Send reset email"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
