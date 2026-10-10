"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Download, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { ExternalHolders } from "@/lib/popia/external-holders";
import { eraseClientAction, exportClientDataAction, markErasureExternalDoneAction } from "./actions";

/**
 * POPIA export and erasure for one client (lib/popia/). Super admin only; the page decides whether
 * to render this. Both confirm buttons are plain Buttons, not AlertDialogAction, which closes the
 * dialog before the action answers (CLAUDE.md §6).
 */
export function PrivacyActions({
  clientId,
  clientName,
  erased,
}: {
  readonly clientId: string;
  readonly clientName: string;
  /** Still rendered once erased, so the dialog survives the refresh and can show the checklist. */
  readonly erased: boolean;
}) {
  return (
    <div className="flex gap-2">
      {!erased && <ExportDialog clientId={clientId} clientName={clientName} />}
      <EraseDialog clientId={clientId} clientName={clientName} erased={erased} />
    </div>
  );
}

/**
 * The outside half of an erasure: what Paystack, Resend, Microsoft and Meta still hold. The email
 * is known only at the moment of erasing, so the page-level notice shows the list without it.
 */
function ExternalCleanupList({ holders, contactEmail }: { readonly holders: ExternalHolders; readonly contactEmail?: string }) {
  const address = contactEmail ? <strong>{contactEmail}</strong> : "their address";
  const items: ReactNode[] = [];
  if (holders.emailsSent > 0) {
    items.push(
      <li key="resend">
        <strong>Resend</strong>: {holders.emailsSent} email{holders.emailsSent === 1 ? "" : "s"} went to {address}, and Resend
        keeps its own log of each. Search for the address in the Resend dashboard and remove what it holds, or note
        their retention period.
      </li>,
    );
  }
  if (holders.paystackReferences.length > 0) {
    items.push(
      <li key="paystack">
        <strong>Paystack</strong>: find the customer through{" "}
        {holders.paystackReferences.length === 1 ? "this reference" : "these references"} and ask Paystack to delete or
        anonymise the customer record. Paystack may keep transactions for its own legal obligations.
        <span className="mt-1 block break-all font-mono text-xs">{holders.paystackReferences.join(", ")}</span>
      </li>,
    );
  }
  if (holders.calendarEvents > 0) {
    items.push(
      <li key="outlook">
        <strong>Outlook</strong>: {holders.calendarEvents} calendar event{holders.calendarEvents === 1 ? "" : "s"} for
        their sessions still list them as an attendee. Remove their name and address from those events, or delete the
        past ones.
      </li>,
    );
  }
  if (holders.whatsappMessages > 0) {
    items.push(
      <li key="whatsapp">
        <strong>WhatsApp</strong>: {holders.whatsappMessages} message{holders.whatsappMessages === 1 ? "" : "s"} went
        through Meta, which holds them under its own terms. Nothing to remove here; tell the client if they ask.
      </li>,
    );
  }
  return (
    <>
      {items.length === 0 ? (
        <p className="text-sm">Nothing outside this system holds their details.</p>
      ) : (
        <ul className="list-disc space-y-2 pl-5 text-sm">{items}</ul>
      )}
      <AuditTrailRetention />
    </>
  );
}

/**
 * The one store inside this system that erasure does not reach. audit_logs is append-only
 * (80_ops.sql), the record of who did what, and is kept. Since 2026-10-10 it masks a client's names
 * and sign-in address as they are written (lib/contacts.ts, recordAuthEvent in lib/audit.ts). Rows
 * written before then are not redacted: the owner chose to state that here rather than rewrite them.
 */
function AuditTrailRetention() {
  return (
    <p className="text-xs text-muted-foreground">
      Kept inside this system: the audit trail, which records who did what and cannot be edited. From
      10 October 2026 it holds only initials and masked addresses for clients. Entries from before
      then may still show their name or email address; they are kept as the record of those actions.
    </p>
  );
}

/** On an erased client, until someone marks the outside clean-up done. */
export function ErasureCleanupNotice({ clientId, holders }: { readonly clientId: string; readonly holders: ExternalHolders }) {
  const [isPending, startTransition] = useTransition();
  function markDone() {
    startTransition(async () => {
      const res = await markErasureExternalDoneAction(clientId);
      if (res.error) toast.error(res.error);
      else toast.success("Outside clean-up recorded as done.");
    });
  }
  return (
    <div className="mt-3 space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <p className="text-sm font-medium">Finish the erasure outside this system</p>
      <ExternalCleanupList holders={holders} />
      <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={markDone}>
        {isPending ? "Saving…" : "Mark done"}
      </Button>
    </div>
  );
}

function ExportDialog({ clientId, clientName }: { readonly clientId: string; readonly clientName: string }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    startTransition(async () => {
      const res = await exportClientDataAction(clientId, notes, code);
      if (res.error || !res.json || !res.filename) {
        toast.error(res.error ?? "The export could not be built.");
        return;
      }
      const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
      setCode("");
      toast.success("Export downloaded. Send it to the client securely.");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Export {clientName}&apos;s data</AlertDialogTitle>
          <AlertDialogDescription>
            Everything held about this client, as one JSON file: profile, assessment, sessions, invoices, payments,
            credits, courses, consents and the emails sent to them. Use it to answer a POPIA access request.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-start gap-2">
          <Checkbox id="exportNotes" checked={notes} onCheckedChange={(v) => setNotes(v === true)} />
          <Label htmlFor="exportNotes" className="text-sm font-normal leading-snug">
            Include the therapist&apos;s session and admin notes. Leave this off if releasing them could harm the
            client (PAIA s30).
          </Label>
        </div>
        <StepUpCodeField id="exportStepUp" value={code} onChange={setCode} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button type="button" disabled={isPending} onClick={handleExport}>
            {isPending ? "Building…" : "Download"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EraseDialog({ clientId, clientName, erased }: { readonly clientId: string; readonly clientName: string; readonly erased: boolean }) {
  const [open, setOpen] = useState(false);
  const [finished, setFinished] = useState<{ retainUntil: string | null; contactEmail: string; holders: ExternalHolders } | null>(null);
  const [code, setCode] = useState("");
  const [typed, setTyped] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleErase() {
    startTransition(async () => {
      const res = await eraseClientAction(clientId, typed, code);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // The dialog stays open on a second step: the address is shown once, here, and nowhere after.
      if (res.contactEmail && res.holders) {
        setFinished({ retainUntil: res.retainUntil ?? null, contactEmail: res.contactEmail, holders: res.holders });
      } else {
        setOpen(false);
      }
      toast.success("Client erased.");
    });
  }

  if (erased && !finished) return null;

  if (finished) {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Erased. Now finish outside the system</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {finished.retainUntil
                    ? `Clinical records are kept, anonymised, until ${finished.retainUntil}, then removed automatically.`
                    : "Clinical records were removed now."}{" "}
                  This is the last time their address is shown: note it before closing if you need it below.
                </p>
                <ExternalCleanupList holders={finished.holders} contactEmail={finished.contactEmail} />
                <p>The client page keeps this list, without the address, until you mark it done.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">
          <ShieldOff className="mr-2 h-4 w-4" />
          Erase client
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Erase {clientName}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                For a POPIA deletion request. Their name, contact details and profile are removed everywhere, and so
                is their login. This cannot be undone. Export their data first if they asked for a copy.
              </p>
              <p>
                Invoices, payments and credits stay exactly as issued, because tax law requires them for five years.
                Assessment answers and session notes are kept, anonymised, for five years after the last session, as
                the privacy policy says, then removed automatically.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1">
          <Label htmlFor="eraseConfirm">Type ERASE to confirm</Label>
          <Input id="eraseConfirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
        <StepUpCodeField id="eraseStepUp" value={code} onChange={setCode} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            disabled={isPending || typed.trim().toUpperCase() !== "ERASE"}
            onClick={handleErase}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending ? "Erasing…" : "Erase"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
