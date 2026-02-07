"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Loader2 } from "lucide-react";

interface UpgradeButtonProps {
  courseId: string;
}

export function UpgradeButton({ courseId }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong");
        setLoading(false);
      }
    } catch {
      setError("Failed to start upgrade");
      setLoading(false);
    }
  }

  return (
    <div>
      <Button size="sm" onClick={handleUpgrade} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <ArrowUpRight className="mr-1 h-4 w-4" />
        )}
        Upgrade Now
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
