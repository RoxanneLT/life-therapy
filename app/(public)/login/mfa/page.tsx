"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

export default function MfaChallengePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);

  const supabase = createBrowserClient();

  const routeByRole = useCallback(async () => {
    const res = await fetch("/api/auth/role");
    const { role } = await res.json();
    const redirectTo = new URLSearchParams(globalThis.location.search).get("redirect") ?? undefined;
    if (role === "admin") {
      router.replace("/admin");
    } else if (role === "student") {
      const dest =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("/admin")
          ? redirectTo
          : "/portal";
      router.replace(dest);
    } else {
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        await routeByRole(); // already stepped up
        return;
      }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        await routeByRole(); // nothing to challenge
        return;
      }
      if (!cancelled) {
        setFactorId(totp.id);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, router, routeByRole]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError("");
    setLoading(true);
    const { error: verErr } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    if (verErr) {
      setError("That code wasn't accepted. Check your authenticator and try again.");
      setLoading(false);
      return;
    }
    router.refresh();
    await routeByRole();
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
          <ShieldCheck className="h-6 w-6 text-brand-700" />
        </div>
        <CardTitle className="font-heading text-2xl">Two-Factor Verification</CardTitle>
        <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
      </CardHeader>
      <CardContent>
        {checking ? (
          <p className="text-center text-sm text-muted-foreground">Checking…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Authentication code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="text-center text-lg tracking-[0.4em]"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
