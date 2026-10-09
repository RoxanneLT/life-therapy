"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const REFRESH_MS = 120_000;

/**
 * Sidebar count badges, keyed by nav href. Fetched on mount, on every page change (a fix made on
 * one page should clear the badge by the next), and every two minutes while the tab is open.
 * A failed fetch keeps the last counts: a badge that blinks out on a network hiccup reads as "done".
 */
export function useNavBadges(): Record<string, number> {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/nav-badges", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { badges?: Record<string, number> };
        if (!cancelled && data.badges) setBadges(data.badges);
      } catch {
        // keep the last counts
      }
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pathname]);

  return badges;
}
