"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function CalendarWarningToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const warning = searchParams.get("calendarWarning");

  useEffect(() => {
    if (!warning) return;
    toast.warning(warning, { duration: 10000 });
    // Strip the param from the URL without triggering a navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("calendarWarning");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [warning, router]);

  return null;
}
