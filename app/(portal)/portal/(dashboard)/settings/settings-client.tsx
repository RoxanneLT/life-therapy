"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";
import { updateProfileAction, changePasswordAction } from "./actions";

interface SettingsClientProps {
  firstName: string;
  lastName: string;
  email: string;
}

export function SettingsClient({
  firstName: initFirst,
  lastName: initLast,
  email,
}: SettingsClientProps) {
  const [firstName, setFirstName] = useState(initFirst);
  const [lastName, setLastName] = useState(initLast);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  async function handleUpdateProfile() {
    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const result = await updateProfileAction(firstName.trim(), lastName.trim());
      if ("error" in result) {
        setProfileError(result.error || "An error occurred");
      } else {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      setPwError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match");
      return;
    }

    setPwLoading(true);
    setPwError(null);
    setPwSuccess(false);
    try {
      const result = await changePasswordAction(currentPassword, newPassword);
      if ("error" in result) {
        setPwError(result.error || "An error occurred");
      } else {
        setPwSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPwSuccess(false), 3000);
      }
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Email</Label>
            <Input value={email} disabled className="mt-1 bg-muted" />
          </div>
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
          {profileError && (
            <p className="text-sm text-destructive">{profileError}</p>
          )}
          <Button
            onClick={handleUpdateProfile}
            disabled={profileLoading}
          >
            {profileLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : profileSuccess ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : null}
            {profileSuccess ? "Saved" : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
          {pwError && (
            <p className="text-sm text-destructive">{pwError}</p>
          )}
          <Button onClick={handleChangePassword} disabled={pwLoading}>
            {pwLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : pwSuccess ? (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            ) : null}
            {pwSuccess ? "Password Updated" : "Update Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
