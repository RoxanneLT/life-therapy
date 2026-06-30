"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { MapPin, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getBranchOptionsAction,
  updateClientBranchAction,
  sendReviewRequestAction,
} from "../actions";

const NONE = "__none__";

interface BranchOption {
  slug: string;
  label: string;
  hasReview: boolean;
}

export function ClientBranchSelect({
  studentId,
  current,
}: {
  readonly studentId: string;
  readonly current: string | null;
}) {
  const [options, setOptions] = useState<BranchOption[]>([]);
  const [value, setValue] = useState<string>(current || NONE);
  const [isPending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getBranchOptionsAction()
      .then(setOptions)
      .catch(() => {});
  }, []);

  function handleChange(v: string) {
    const previous = value;
    setValue(v);
    startTransition(async () => {
      try {
        await updateClientBranchAction(studentId, v === NONE ? null : v);
        toast.success("Office branch updated.");
      } catch {
        toast.error("Could not update the branch.");
        setValue(previous);
      }
    });
  }

  async function handleSend() {
    setSending(true);
    const res = await sendReviewRequestAction(studentId);
    if (res.success) {
      toast.success("Google review request sent.");
    } else {
      toast.error(res.error || "Could not send the review request.");
    }
    setSending(false);
  }

  const selected = options.find((o) => o.slug === value);
  const canSend = value !== NONE && !!selected?.hasReview;

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          Office branch
        </Label>
        <Select value={value} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Not assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not assigned</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.slug} value={o.slug}>
                {o.label}
                {!o.hasReview && " — no review link yet"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Sets which location this client belongs to — routes their Google review request.
        </p>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="w-full" disabled={!canSend || sending}>
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Star className="mr-2 h-4 w-4" />
            )}
            Send Google review request
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send a Google review request?</AlertDialogTitle>
            <AlertDialogDescription>
              Emails this client a link to leave a Google review for the{" "}
              <strong>{selected?.label}</strong> profile. Space these out (Google flags review
              spikes).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={sending}
              onClick={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              Send request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
