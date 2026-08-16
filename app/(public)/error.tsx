"use client";

/**
 * Public-site error boundary. Without one, any uncaught render or action error
 * showed a visitor React's built-in notice — in production, the "An error occurred
 * in the Server Components render… a digest property is included" wall of text, on
 * a marketing or booking page.
 *
 * Deliberately warmer and less technical than the admin boundary: a visitor can do
 * nothing with a digest, so it is not shown. It is still logged to the console and
 * recorded server-side.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("Public error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-2xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        Sorry — this page ran into a problem. Nothing you entered has been lost, and
        no booking was made.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/book">Back to booking</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/">Home</Link>
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        If it keeps happening, please get in touch and we&apos;ll sort it out.
      </p>
    </div>
  );
}
