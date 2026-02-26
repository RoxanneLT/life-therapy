"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { redeemGiftAction } from "./actions";

interface RedeemClientProps {
  token: string;
  itemTitle: string;
  buyerName: string;
  message?: string | null;
  recipientEmail: string;
  hasExistingAccount: boolean;
}

export function RedeemClient({
  token,
  itemTitle,
  buyerName,
  message,
  recipientEmail,
  hasExistingAccount,
}: Readonly<RedeemClientProps>) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRedeem() {
    setLoading(true);
    setError(null);

    try {
      if (hasExistingAccount) {
        // Existing account — just redeem
        const result = await redeemGiftAction(token);
        if ("error" in result) {
          setError(result.error || "Redemption failed");
        } else {
          setSuccess(true);
        }
      } else {
        // New account — validate fields
        if (!firstName.trim() || !lastName.trim()) {
          setError("Please enter your name");
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        const result = await redeemGiftAction(token, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          password,
        });
        if ("error" in result) {
          setError(result.error || "Redemption failed");
        } else {
          setSuccess(true);
        }
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
        <h1 className="font-heading text-2xl font-bold">
          Gift Redeemed!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your gift has been added to your account. Log in to access your
          courses.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/portal/login">Go to Portal</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 text-center">
        <Gift className="mx-auto mb-4 h-16 w-16 text-brand-500" />
        <h1 className="font-heading text-2xl font-bold">
          You&apos;ve Received a Gift!
        </h1>
        <p className="mt-2 text-muted-foreground">
          <strong>{buyerName}</strong> sent you:
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 text-center">
          <p className="text-lg font-semibold">{itemTitle}</p>
          {message && (
            <div className="mt-3 rounded-md border border-dashed border-amber-200 bg-amber-50 p-3 text-sm italic text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
              &ldquo;{message}&rdquo;
            </div>
          )}
        </CardContent>
      </Card>

      {hasExistingAccount ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              We found an account for <strong>{recipientEmail}</strong>. Click
              below to add this gift to your account.
            </p>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              className="w-full"
              onClick={handleRedeem}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Redeem Gift
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-muted-foreground">
              Create an account to redeem your gift. Your email:{" "}
              <strong>{recipientEmail}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="text-xs">
                  First Name
                </Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lastName" className="text-xs">
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-xs">
                Choose a Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              className="w-full"
              onClick={handleRedeem}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Account & Redeem
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
