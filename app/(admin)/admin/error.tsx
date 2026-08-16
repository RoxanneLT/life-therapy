"use client";

/**
 * The admin area had NO error boundary anywhere in `app/` — so any uncaught
 * server-action throw or render error replaced the whole page with React's
 * built-in notice, whose message production strips to "An error occurred in the
 * Server Components render… a digest property is included on this error
 * instance". Roxanne saw that sentence and nothing else: no page to go back to,
 * and no way to tell a duplicate-email refusal from a real outage.
 *
 * This boundary keeps the admin usable (retry, or leave for the dashboard) and —
 * critically — SHOWS the digest, which is the only handle on the underlying
 * error in the Vercel logs. Read it back to whoever is debugging.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    // Server-side the throw is already logged; this catches the client half.
    console.error("Admin error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4 rounded-lg border bg-background p-6">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          This page hit an error. Nothing you were viewing has been changed — but if
          you were saving, assume it did not save.
        </p>

        {/* In development the real message survives; in production it won't, which
            is exactly why the digest below matters. */}
        {error.message && (
          <p className="break-words rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error.message}
          </p>
        )}

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Reference code: <code className="font-mono">{error.digest}</code>
            <br />
            Quote this when reporting the problem — it identifies the exact error in
            the server logs.
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={reset}>
            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
