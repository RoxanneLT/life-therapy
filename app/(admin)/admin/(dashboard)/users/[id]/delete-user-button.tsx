"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StepUpCodeField } from "@/components/admin/step-up-code-field";
import { deleteUser } from "../actions";

/**
 * A client component so the refusal can be SHOWN. It was a bare <form action> in the page, which
 * is why deleteUser threw its "cannot delete your own account" message into React's digest; with
 * a 2FA code that can be mistyped, a refusal is now the ordinary case.
 */
export function DeleteUserButton({ adminUserId, label }: { readonly adminUserId: string; readonly label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const res = await deleteUser(adminUserId, code);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(`${label} has been deleted.`);
      router.push("/admin/settings/team");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete User
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete User</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {label}&apos;s account. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <StepUpCodeField id="deleteUserStepUp" value={code} onChange={setCode} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction: that closes the dialog on click, before the
              action has answered (CLAUDE.md §6, the delete dialog that took the form with it). */}
          <Button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
