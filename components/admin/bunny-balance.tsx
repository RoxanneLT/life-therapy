"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function BunnyBalance() {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/bunny-balance")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setBalance(d.balance))
      .catch(() => {});
  }, []);

  if (balance === null) return null;

  const isLow = balance < 5;

  return (
    <div
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium md:flex",
        isLow
          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "border-muted bg-muted/50 text-muted-foreground",
      )}
      title="Bunny.net credit balance"
    >
      <span className="text-[11px]">🐰</span>
      ${balance.toFixed(2)}
    </div>
  );
}
