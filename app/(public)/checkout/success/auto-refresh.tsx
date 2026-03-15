"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_RETRIES = 8;
const INTERVAL_MS = 3000;

export function AutoRefresh({ url }: { readonly url: string }) {
  const router = useRouter();
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (retries >= MAX_RETRIES) return;

    const timer = setTimeout(() => {
      setRetries((r) => r + 1);
      router.refresh();
    }, INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [retries, router, url]);

  if (retries >= MAX_RETRIES) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Taking longer than expected. Your order is confirmed &mdash; check your
        email or visit your portal.
      </p>
    );
  }

  return null;
}
