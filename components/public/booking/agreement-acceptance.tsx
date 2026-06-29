"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText } from "lucide-react";
import { acceptBookingAgreementsAction } from "@/app/(public)/book/actions";

/**
 * Shown on the booking confirmation page when the client still has outstanding
 * agreements (typically a free consultation where they skipped the optional
 * checkbox). No login required — acceptance is recorded against the booking's
 * student via the confirmation token.
 */
export function AgreementAcceptance({ token }: { readonly token: string }) {
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAccept() {
    setError("");
    startTransition(async () => {
      const res = await acceptBookingAgreementsAction(token);
      if (res.success) setDone(true);
      else setError(res.error ?? "Something went wrong. Please try again.");
    });
  }

  if (done) {
    return (
      <div className="mt-8 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-6 dark:border-green-900 dark:bg-green-950/30">
        <CheckCircle className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
        <p className="text-sm text-green-800 dark:text-green-300">
          Thank you — your agreement to the Terms &amp; Conditions and Therapeutic Commitment has been recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4 rounded-lg border border-brand-200 bg-brand-50/50 p-6 dark:border-brand-900 dark:bg-brand-950/20">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />
        <h3 className="font-heading text-lg font-semibold">One last thing</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Please confirm your agreements before your session.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
        />
        <span>
          I have read and agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-800">
            Terms &amp; Conditions
          </a>{" "}
          and{" "}
          <a href="/commitment" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-800">
            Therapeutic Commitment
          </a>
          .
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={handleAccept} disabled={!agreed || isPending}>
        {isPending ? "Saving…" : "Confirm Agreement"}
      </Button>
    </div>
  );
}
