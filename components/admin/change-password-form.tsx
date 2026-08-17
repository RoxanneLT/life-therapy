"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changePassword } from "@/app/(admin)/admin/(dashboard)/users/actions";

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("newPassword", newPassword);
      formData.set("confirmPassword", confirmPassword);
      const result = await changePassword(formData);
      if (!result.success) {
        // The server's reason, shown as-is. The checks above catch the two
        // obvious cases before the round trip; this is for the ones only
        // Supabase knows about.
        toast.error(result.error ?? "Failed to change password");
        return;
      }
      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      // A thrown error now means the request itself failed, not a refusal.
      toast.error("Could not reach the server — please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Update password
      </Button>
    </form>
  );
}
