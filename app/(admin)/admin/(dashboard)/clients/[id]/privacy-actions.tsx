"use client";

import { useState, useTransition } from "react";
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
import { eraseClientAction, exportClientDataAction } from "./actions";

/**
 * POPIA export and erasure for one client (lib/popia/). Super admin only; the page decides whether
 * to render this. Both confirm buttons are plain Buttons, not AlertDialogAction, which closes the
 * dialog before the action answers (CLAUDE.md §6).
 */
export function PrivacyActions({ clientId, clientName }: { readonly clientId: string; readonly clientName: string }) {
  return (
    <div className="flex gap-2">
      <ExportDialog clientId={clientId} clientName={clientName} />
      <EraseDialog clientId={clientId} clientName={clientName} />
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

function EraseDialog({ clientId, clientName }: { readonly clientId: string; readonly clientName: string }) {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
      toast.success(
        res.retainUntil
          ? `Client erased. Clinical records are kept, anonymised, until ${res.retainUntil}, then removed automatically.`
          : "Client erased.",
      );
    });
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
