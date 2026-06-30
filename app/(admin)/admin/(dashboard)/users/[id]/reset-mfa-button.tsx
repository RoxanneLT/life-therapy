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
import { ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { removeUserMfaAction } from "../actions";

export function ResetMfaButton({ adminUserId }: { readonly adminUserId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleReset() {
    startTransition(async () => {
      const res = await removeUserMfaAction(adminUserId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("2FA removed — they can sign in with their password and re-enrol.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ShieldOff className="mr-2 h-4 w-4" />
          Reset 2FA
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset two-factor authentication?</AlertDialogTitle>
          <AlertDialogDescription>
            Removes this admin&apos;s authenticator so they can sign in with their password
            and set 2FA up again. Use this only if they&apos;ve lost access to their authenticator app.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleReset();
            }}
          >
            {isPending ? "Removing…" : "Reset 2FA"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
