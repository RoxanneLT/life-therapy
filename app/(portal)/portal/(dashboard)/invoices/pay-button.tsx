"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface PayButtonProps {
  readonly type: "payment_request" | "invoice";
  readonly id: string;
  readonly label?: string;
}

export function PayButton({ type, id, label = "Pay Now" }: PayButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Payment initialization failed");
      }

      window.location.href = data.authorization_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
      setLoading(false);
    }
  }

  return (
    <Button onClick={handlePay} disabled={loading} size="sm">
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CreditCard className="mr-2 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
