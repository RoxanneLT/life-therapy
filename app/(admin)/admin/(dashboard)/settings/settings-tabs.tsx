"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "settings", label: "Settings" },
  { key: "users", label: "Users" },
  { key: "finance", label: "Finance" },
  { key: "legal", label: "Legal Documents" },
  { key: "whatsapp", label: "WhatsApp" },
] as const;

interface SettingsTabsProps {
  readonly activeTab: string;
}

export function SettingsTabs({ activeTab }: SettingsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "settings") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => setTab(tab.key)}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === tab.key
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
