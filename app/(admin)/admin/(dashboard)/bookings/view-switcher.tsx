"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { List, CalendarDays, CalendarRange, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "list", label: "List", icon: List },
  { key: "day", label: "Day", icon: CalendarDays },
  { key: "week", label: "Week", icon: CalendarRange },
  { key: "month", label: "Month", icon: Calendar },
] as const;

interface ViewSwitcherProps {
  activeView: string;
}

export function ViewSwitcher({ activeView }: ViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSwitch(view: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (view === "list") {
      params.delete("view");
      params.delete("date");
    } else {
      params.set("view", view);
    }
    router.push(`/admin/bookings?${params.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border bg-muted p-1">
      {VIEWS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => handleSwitch(key)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeView === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
