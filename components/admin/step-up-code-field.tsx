"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The "type your 2FA code to confirm" field for the admin actions that grant or remove access.
 * The server re-verifies it (confirmWithTotp in lib/mfa-step-up.ts); this only collects it.
 */
export function StepUpCodeField({
  value,
  onChange,
  id = "stepUpCode",
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly id?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Your 2FA code</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        className="max-w-[10rem] font-mono tracking-widest"
      />
      <p className="text-xs text-muted-foreground">
        From your own authenticator app. Changes to who has access need a fresh code.
      </p>
    </div>
  );
}
