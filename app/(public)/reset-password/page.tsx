"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
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
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { updatePasswordAction } from "../forgot-password/actions";

const initialState = {
  error: undefined as string | undefined,
  success: undefined as boolean | undefined,
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState("");

  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
    initialState,
  );

  function handleSubmit(formData: FormData) {
    const password = formData.get("new_password") as string;
    const confirm = formData.get("confirm_password") as string;

    if (password !== confirm) {
      setConfirmError("Passwords do not match.");
      return;
    }
    setConfirmError("");
    formAction(formData);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-brand-50 via-cream-50 to-brand-100">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Image
            src="/logo.png"
            alt="Life-Therapy"
            width={200}
            height={50}
            className="mx-auto mb-2 h-12 w-auto"
          />
          <CardTitle className="font-heading text-2xl">
            {state.success ? "Password Updated" : "Set New Password"}
          </CardTitle>
          <CardDescription>
            {state.success
              ? "Your password has been reset successfully."
              : "Choose a new password for your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.success ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
              <p className="text-sm text-muted-foreground">
                You can now sign in with your new password.
              </p>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Sign In
              </Button>
            </div>
          ) : (
            <>
              {(state.error || confirmError) && (
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {confirmError || state.error}
                </div>
              )}
              <form action={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      name="new_password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      required
                      autoComplete="new-password"
                      disabled={isPending}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm_password"
                      name="confirm_password"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Re-enter your password"
                      required
                      autoComplete="new-password"
                      disabled={isPending}
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
              <p className="mt-4 text-center">
                <Link
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
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
