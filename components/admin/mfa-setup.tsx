"use client";

import { useState, useEffect, useCallback } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldCheck, ShieldOff, Loader2, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Factor {
  id: string;
  friendlyName?: string;
  status: string;
}

export function MfaSetup() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  // Enrolment state
  const [enrolling, setEnrolling] = useState(false);
  const [pending, setPending] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  const supabase = createBrowserClient();

  const loadFactors = useCallback(async () => {
    const { data, error: listErr } = await supabase.auth.mfa.listFactors();
    if (listErr) {
      setError(listErr.message);
    } else {
      // Verified TOTP factors only
      setFactors(
        (data?.totp ?? []).map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? undefined, status: f.status })),
      );
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const hasVerified = factors.some((f) => f.status === "verified");

  async function startEnrol() {
    setError("");
    setEnrolling(true);
    try {
      // Clear any leftover unverified factors so a retry doesn't collide.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error: enrErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrErr || !data) {
        setError(enrErr?.message ?? "Could not start 2FA setup.");
        return;
      }
      setPending({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } finally {
      setEnrolling(false);
    }
  }

  async function verifyEnrol() {
    if (!pending) return;
    setError("");
    setVerifying(true);
    try {
      const { error: verErr } = await supabase.auth.mfa.challengeAndVerify({
        factorId: pending.factorId,
        code: code.trim(),
      });
      if (verErr) {
        setError("That code wasn't accepted. Check your authenticator and try again.");
        return;
      }
      toast.success("Two-factor authentication is now enabled.");
      setPending(null);
      setCode("");
      await loadFactors();
    } finally {
      setVerifying(false);
    }
  }

  async function cancelEnrol() {
    if (pending) {
      await supabase.auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => {});
    }
    setPending(null);
    setCode("");
    setError("");
  }

  async function removeFactor(factorId: string) {
    const { error: rmErr } = await supabase.auth.mfa.unenroll({ factorId });
    if (rmErr) {
      toast.error(rmErr.message);
      return;
    }
    toast.success("Two-factor authentication removed.");
    await loadFactors();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {hasVerified ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
          )}
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Protect your admin account with an authenticator app (Google Authenticator, 1Password, Authy…).
          You&apos;ll enter a 6-digit code at sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : pending ? (
          <div className="space-y-4">
            <p className="text-sm">
              Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pending.qr} alt="2FA QR code" className="h-44 w-44 rounded-md border bg-white p-2" />
            <p className="text-xs text-muted-foreground">
              Can&apos;t scan? Enter this key manually:{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{pending.secret}</code>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-code">6-digit code</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-40 tracking-widest"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button onClick={verifyEnrol} disabled={verifying || code.length !== 6}>
                {verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm &amp; Enable
              </Button>
              <Button variant="ghost" onClick={cancelEnrol} disabled={verifying}>
                Cancel
              </Button>
            </div>
          </div>
        ) : hasVerified ? (
          <div className="space-y-3">
            {factors
              .filter((f) => f.status === "verified")
              .map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-md border bg-card px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{f.friendlyName || "Authenticator app"}</span>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                      Active
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" aria-label="Remove 2FA">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove two-factor authentication?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Your account will be protected by password only. You can re-enable it any time.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => removeFactor(f.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
          </div>
        ) : (
          <div className="space-y-3">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={startEnrol} disabled={enrolling}>
              {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <ShieldCheck className="mr-2 h-4 w-4" />
              Enable 2FA
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
