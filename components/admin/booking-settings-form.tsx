"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { updateBookingSettings } from "@/app/(admin)/admin/(dashboard)/bookings/settings/actions";
import type { SiteSetting } from "@/lib/generated/prisma/client";

interface BookingSettingsFormProps {
  readonly initialSettings: SiteSetting;
  readonly msGraphConfigured: boolean;
}

export function BookingSettingsForm({
  initialSettings,
  msGraphConfigured,
}: BookingSettingsFormProps) {
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(initialSettings.bookingEnabled);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("bookingEnabled", enabled.toString());
      await updateBookingSettings(formData);
      toast.success("Booking settings saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Booking Toggle */}
      <Card>
        <CardHeader>
          <CardTitle>Online Booking</CardTitle>
          <CardDescription>
            Enable or disable the public booking system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>{enabled ? "Booking enabled" : "Booking disabled"}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Scheduling Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduling Rules</CardTitle>
          <CardDescription>
            Control how far ahead clients can book and the minimum notice
            required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bookingMaxAdvanceDays">
                Max advance booking (days)
              </Label>
              <Input
                id="bookingMaxAdvanceDays"
                name="bookingMaxAdvanceDays"
                type="number"
                min={1}
                max={365}
                defaultValue={initialSettings.bookingMaxAdvanceDays}
              />
              <p className="text-xs text-muted-foreground">
                How far ahead clients can book
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bookingMinNoticeHours">
                Minimum notice (hours)
              </Label>
              <Input
                id="bookingMinNoticeHours"
                name="bookingMinNoticeHours"
                type="number"
                min={0}
                max={168}
                defaultValue={initialSettings.bookingMinNoticeHours}
              />
              <p className="text-xs text-muted-foreground">
                Required lead time before a session
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bookingBufferMinutes">
                Buffer between sessions (minutes)
              </Label>
              <Input
                id="bookingBufferMinutes"
                name="bookingBufferMinutes"
                type="number"
                min={0}
                max={120}
                defaultValue={initialSettings.bookingBufferMinutes}
              />
              <p className="text-xs text-muted-foreground">
                Prep time — prevents back-to-back sessions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Microsoft Graph / Exchange */}
      <Card>
        <CardHeader>
          <CardTitle>Microsoft 365 Integration</CardTitle>
          <CardDescription>
            Exchange calendar integration for real-time availability and
            automatic Teams meeting links.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {msGraphConfigured ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  MS Graph credentials configured via environment variables
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-amber-600">
                  Not configured — set <code className="text-xs">MS_GRAPH_*</code> environment variables
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Booking Settings
        </Button>
      </div>
    </form>
  );
}
