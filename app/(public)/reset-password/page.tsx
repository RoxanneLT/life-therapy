"use client";

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
import { CheckCircle2, Loader2 } from "lucide-react";
import { updatePasswordAction } from "../forgot-password/actions";

const initialState = {
  error: undefined as string | undefined,
  success: undefined as boolean | undefined,
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    updatePasswordAction,
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
              {state.error && (
                <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {state.error}
                </div>
              )}
              <form action={formAction} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    name="new_password"
                    type="password"
                    placeholder="At least 6 characters"
                    required
                    autoComplete="new-password"
                    disabled={isPending}
                    minLength={6}
                  />
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
