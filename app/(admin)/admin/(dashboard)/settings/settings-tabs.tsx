"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface SettingsTabsProps {
  activeTab: string;
}

export function SettingsTabs({ activeTab }: SettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "users") {
      params.set("tab", "users");
    } else {
      params.delete("tab");
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-1 border-b">
      <button
        type="button"
        onClick={() => setTab("settings")}
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
          activeTab === "settings"
            ? "border-brand-600 text-brand-700"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        Settings
      </button>
      <button
        type="button"
        onClick={() => setTab("users")}
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
          activeTab === "users"
            ? "border-brand-600 text-brand-700"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        Users
      </button>
    </div>
  );
}
