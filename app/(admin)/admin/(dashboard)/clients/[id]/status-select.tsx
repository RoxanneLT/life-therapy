"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { updateClientStatusAction, checkClientDocumentAcceptanceAction } from "../actions";
import { AlertTriangle, Loader2, UserCheck, ShieldAlert } from "lucide-react";

const STATUSES = [
  { value: "potential", label: "Potential" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

export function StatusSelect({
  clientId,
  currentStatus,
  clientName,
  onOpenConvertDialog,
}: {
  clientId: string;
  currentStatus: string;
  clientName?: string;
  onOpenConvertDialog?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showTandCWarning, setShowTandCWarning] = useState(false);
  const [showDeactivateWarning, setShowDeactivateWarning] = useState(false);
  const [checkingDocs, setCheckingDocs] = useState(false);

  async function handleChange(value: string) {
    if (value === currentStatus) return;

    // Gate: activating from potential → check T&C acceptance
    if (value === "active" && currentStatus === "potential") {
      setCheckingDocs(true);
      const hasSigned = await checkClientDocumentAcceptanceAction(clientId);
      setCheckingDocs(false);

      if (!hasSigned) {
        setPendingStatus(value);
        setShowTandCWarning(true);
        return;
      }
    }

    // Gate: deactivating or archiving
    if (
      (value === "inactive" || value === "archived") &&
      currentStatus === "active"
    ) {
      setPendingStatus(value);
      setShowDeactivateWarning(true);
      return;
    }

    applyStatusChange(value);
  }

  function applyStatusChange(value: string) {
    startTransition(async () => {
      try {
        await updateClientStatusAction(clientId, value);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to update status");
      }
    });
  }

  function handleActivateAnyway() {
    if (pendingStatus) applyStatusChange(pendingStatus);
    setShowTandCWarning(false);
    setPendingStatus(null);
  }

  function handleUseConvertDialog() {
    setShowTandCWarning(false);
    setPendingStatus(null);
    onOpenConvertDialog?.();
  }

  function handleDeactivateConfirm() {
    if (pendingStatus) applyStatusChange(pendingStatus);
    setShowDeactivateWarning(false);
    setPendingStatus(null);
  }

  const displayName = clientName || "this client";
  const isArchiving = pendingStatus === "archived";

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Select
          value={currentStatus}
          onValueChange={handleChange}
          disabled={isPending || checkingDocs}
        >
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(isPending || checkingDocs) && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* T&C Warning Dialog */}
      <AlertDialog open={showTandCWarning} onOpenChange={setShowTandCWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Client Has Not Signed T&Cs
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This client has <strong>not accepted the Terms &amp; Conditions
                  or Commitment document</strong>. Activating without these
                  signed means there is no record of consent.
                </p>
                <p>
                  The recommended flow is to use the{" "}
                  <strong>Convert to Client</strong> button, which sends the
                  client a welcome email with a portal link where they can
                  review and sign the documents before their first session.
                </p>
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
                  Only activate without T&Cs if the client signed physical
                  documents or you are migrating an existing client into the
                  system.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {onOpenConvertDialog && (
              <Button
                variant="outline"
                onClick={handleUseConvertDialog}
                className="gap-1.5"
              >
                <UserCheck className="h-4 w-4" />
                Use Convert Dialog
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleActivateAnyway}
              className="gap-1.5"
            >
              <AlertTriangle className="h-4 w-4" />
              Activate Anyway
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate/Archive Warning Dialog */}
      <AlertDialog open={showDeactivateWarning} onOpenChange={setShowDeactivateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              {isArchiving ? `Archive ${displayName}?` : `Deactivate ${displayName}?`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              {isArchiving ? (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Archiving is intended for clients you no longer work with.
                    This will:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Hide them from all client lists and search by default</li>
                    <li>Stop all email communications</li>
                    <li>Preserve all session history, invoices, and records</li>
                  </ul>
                  <p>
                    You can un-archive them by filtering for archived clients
                    and changing their status.
                  </p>
                  <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">
                    Only archive if you are certain this client relationship
                    has permanently ended.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Setting this client to Inactive will:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Prevent new bookings from being made for them</li>
                    <li>Pause their drip email sequence</li>
                    <li>Hide them from the active client list</li>
                  </ul>
                  <p>
                    Their session history, invoices, and data are preserved.
                    You can reactivate them at any time.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeactivateConfirm}
            >
              {isArchiving ? "Archive Client" : "Set as Inactive"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
