"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordSettingsVisitAction } from "@/app/(admin)/admin/(dashboard)/settings/actions";

/**
 * Mounted in the settings layout — bumps the per-admin visit count for whichever
 * settings page is open, feeding the Overview "Most used" cards. Fire-and-forget.
 */
export function SettingsUsageRecorder() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) recordSettingsVisitAction(pathname).catch(() => {});
  }, [pathname]);
  return null;
}
