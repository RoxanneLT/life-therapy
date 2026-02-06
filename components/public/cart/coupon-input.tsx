"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, X, Loader2 } from "lucide-react";

interface CouponInputProps {
  onApply: (code: string) => Promise<{
    valid: boolean;
    error?: string;
    discountCents?: number;
    code?: string;
  }>;
  appliedCoupon: { code: string; discountCents: number } | null;
  onRemove: () => void;
}

export function CouponInput({
  onApply,
  appliedCoupon,
  onRemove,
}: CouponInputProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await onApply(code.trim());
      if (!result.valid) {
        setError(result.error || "Invalid coupon");
      } else {
        setCode("");
      }
    } catch {
      setError("Failed to validate coupon");
    } finally {
      setLoading(false);
    }
  }

  if (appliedCoupon) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-950/30">
        <Tag className="h-4 w-4 text-green-600" />
        <span className="flex-1 text-sm font-medium text-green-700 dark:text-green-400">
          {appliedCoupon.code} applied
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onRemove}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="Coupon code"
          className="h-9 flex-1 uppercase"
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleApply}
          disabled={loading || !code.trim()}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
