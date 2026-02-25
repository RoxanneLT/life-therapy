"use client";

import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { requestPasswordResetAction } from "./actions";

const initialState = {
  error: undefined as string | undefined,
  success: undefined as boolean | undefined,
};

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    initialState,
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 via-cream-50 to-brand-100">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Image
            src="/logo.png"
            alt="Life-Therapy"
            width={200}
            height={50}
            className="mx-auto mb-2 h-12 w-auto"
          />
          <CardTitle className="font-heading text-2xl">Reset Password</CardTitle>
          <CardDescription>
            {state.success
              ? "Check your email for a reset link"
              : "Enter your email and we\u2019ll send you a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.success ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-sm text-muted-foreground">
                If an account exists with that email, we&apos;ve sent a
                password reset link. Please check your inbox (and spam folder).
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <form action={formAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    disabled={isPending}
                  />
                </div>
                {state.error && (
                  <p className="text-sm text-destructive">{state.error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
              <p className="mt-4 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
