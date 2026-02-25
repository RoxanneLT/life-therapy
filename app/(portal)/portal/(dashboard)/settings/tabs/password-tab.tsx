"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { changePasswordAction } from "../actions";

interface PasswordTabProps {
  readonly email: string;
}

export function PasswordTab({ email }: PasswordTabProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await changePasswordAction(currentPassword, newPassword);
      if ("error" in result) {
        setError(result.error || "An error occurred");
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setSuccess(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Change Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs">Email</Label>
          <Input value={email} disabled className="mt-1 bg-muted" />
        </div>
        <div>
          <Label htmlFor="currentPassword" className="text-xs">
            Current Password
          </Label>
          <Input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="newPassword" className="text-xs">
            New Password
          </Label>
          <Input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1"
            minLength={6}
          />
        </div>
        <div>
          <Label htmlFor="confirmPassword" className="text-xs">
            Confirm New Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleChangePassword} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : success ? (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          ) : null}
          {success ? "Password Updated" : "Update Password"}
        </Button>
      </CardContent>
    </Card>
  );
}
