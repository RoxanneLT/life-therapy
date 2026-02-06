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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createAvailabilityOverride } from "@/app/(admin)/admin/(dashboard)/bookings/availability/actions";

export function AvailabilityOverrideForm() {
  const [saving, setSaving] = useState(false);
  const [isBlocked, setIsBlocked] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("isBlocked", isBlocked.toString());
      await createAvailabilityOverride(formData);
      toast.success("Availability override saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save override"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Override</CardTitle>
        <CardDescription>
          Block a day off or set custom hours for a specific date.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isBlocked} onCheckedChange={setIsBlocked} />
            <Label>
              {isBlocked ? "Block entire day" : "Custom hours"}
            </Label>
          </div>

          {!isBlocked && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Open</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  defaultValue="09:00"
                  required={!isBlocked}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Close</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  defaultValue="17:00"
                  required={!isBlocked}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="reason"
              name="reason"
              placeholder="e.g. Public holiday, Annual leave"
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Override
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
