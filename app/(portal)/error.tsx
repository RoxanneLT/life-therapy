"use client";

/**
 * Client-portal error boundary. Same reasoning as the public one: a client who hits
 * an uncaught error should get a way forward, not React's digest text.
 */

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PortalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("Portal error boundary:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-heading text-2xl font-bold">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        Sorry — we couldn&apos;t load this page. Your sessions and details are safe.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/portal">Back to my portal</Link>
        </Button>
      </div>
    </div>
  );
}
