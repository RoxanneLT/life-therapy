"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SettingsTab {
  id: string;
  label: string;
}

/**
 * In-page tab strip wired to the URL `?tab=`. The server page reads `?tab` and
 * renders the matching body, so tabs deep-link. Life-Therapy admin styling
 * (underline, brand active state) — mirrors the old settings tab strip.
 */
export function SettingsTabs({
  tabs,
  current,
}: Readonly<{ tabs: SettingsTab[]; current: string }>) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setTab(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("tab", id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setTab(tab.id)}
          className={cn(
            "shrink-0 cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px",
            current === tab.id
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
