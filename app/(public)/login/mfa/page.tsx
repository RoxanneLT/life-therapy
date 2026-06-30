"use client";

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { verifyMfaAction } from "./actions";
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

const BOUNCE_KEY = "lt_mfa_bounce";

export default function MfaChallengePage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  const supabase = createBrowserClient();

  // Hard navigation (NOT router.replace) so the browser sends the freshest
  // cookies and the server re-evaluates auth from scratch — no RSC cache to
  // race the cookie write.
  const routeByRole = useCallback(async () => {
    const res = await fetch("/api/auth/role");
    const { role } = await res.json();
    const redirectTo = new URLSearchParams(globalThis.location.search).get("redirect") ?? undefined;
    if (role === "admin") {
      globalThis.location.assign("/admin");
    } else if (role === "student") {
      const dest =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("/admin")
          ? redirectTo
          : "/portal";
      globalThis.location.assign(dest);
    } else {
      globalThis.location.assign("/login");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        globalThis.location.assign("/login");
        return;
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") {
        // Client says verified. If the server keeps bouncing us back here, the
        // session cookie is out of sync — break the loop after a couple of tries
        // by signing out and restarting cleanly rather than spinning forever.
        const bounces = Number(sessionStorage.getItem(BOUNCE_KEY) || "0") + 1;
        if (bounces > 2) {
          sessionStorage.removeItem(BOUNCE_KEY);
          await supabase.auth.signOut({ scope: "local" }).catch(() => {});
          globalThis.location.assign("/login");
          return;
        }
        sessionStorage.setItem(BOUNCE_KEY, String(bounces));
        await routeByRole();
        return;
      }

      // Not stepped up — clear any bounce counter and decide what to show.
      sessionStorage.removeItem(BOUNCE_KEY);
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        await routeByRole(); // nothing to challenge — let the gate route them
        return;
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, routeByRole]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const redirectTo = new URLSearchParams(globalThis.location.search).get("redirect") ?? undefined;
    // Server-side verify: sets the AAL2 cookie and redirects in one response.
    // We only return here if it came back with an error.
    const res = await verifyMfaAction(code.trim(), redirectTo);
    if (res?.error) {
      setError(res.error);
      setSubmitting(false);
    }
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
            <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
